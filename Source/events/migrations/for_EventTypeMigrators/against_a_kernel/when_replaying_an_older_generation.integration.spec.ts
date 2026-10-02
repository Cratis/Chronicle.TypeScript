// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../../artifacts/index.js';
import type { AppendedEvent, EventContext } from '../../../../events/index.js';
import { eventType } from '../../../../events/index.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { fromEvent } from '../../../../projections/index.js';
import { reactor } from '../../../../reactors/index.js';
import { eventTypeMigration } from '../../eventTypeMigration.js';
import type { IEventMigrationBuilder } from '../../IEventMigrationBuilder.js';
import type { IEventTypeMigration } from '../../IEventTypeMigration.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

const eventTypeId = 'migration-replay-author-registered';

@eventType(eventTypeId, 1)
class AuthorRegisteredV1 {
    @field(String) name = '';
}

@eventType(eventTypeId, 2)
class AuthorRegistered {
    @field(String) firstName = '';
    @field(String) lastName = '';
}

@eventTypeMigration(AuthorRegistered, AuthorRegisteredV1)
class AuthorRegisteredMigration implements IEventTypeMigration<AuthorRegistered, AuthorRegisteredV1> {
    upcast(builder: IEventMigrationBuilder<AuthorRegistered, AuthorRegisteredV1>): void {
        builder.properties(_ => _
            .split('firstName', 'name', ' ', 0)
            .split('lastName', 'name', ' ', 1));
    }

    downcast(builder: IEventMigrationBuilder<AuthorRegisteredV1, AuthorRegistered>): void {
        builder.properties(_ => _.combine('name', ' ', 'firstName', 'lastName'));
    }
}

// Projected by the kernel from the second generation.
@fromEvent(AuthorRegistered)
class Author {
    @field(String) firstName = '';
    @field(String) lastName = '';
}

const observed: { event: AuthorRegistered; context: EventContext }[] = [];

@reactor('migration-replay-author-observer')
class AuthorObserver {
    authorRegistered(event: AuthorRegistered, context: EventContext): void {
        observed.push({ event, context });
    }
}

function artifactsWith(overrides: Partial<IClientArtifactsProvider>): IClientArtifactsProvider {
    return {
        eventTypes: [],
        readModels: [],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: [],
        globalForHandlers: [],
        ...overrides
    };
}

function clientWith(artifacts: IClientArtifactsProvider): ChronicleClient {
    return new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
        discoveryPatterns: [],
        clientArtifactsProvider: artifacts
    }));
}

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 30_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for the kernel; last value: ${JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
        await new Promise(resolve => setTimeout(resolve, 250));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when replaying an older generation against a kernel', () => {
    const eventStoreName = `Migration${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const eventSourceId = randomUUID();
    let firstGenerationClient: ChronicleClient;
    let migrationClient: ChronicleClient;
    let secondGenerationClient: ChronicleClient;
    let appendedSequenceNumber: bigint;
    let event: AppendedEvent;
    let author: Author | null;
    let observation: { event: AuthorRegistered; context: EventContext };
    let missingMigrationError: unknown;

    beforeAll(async () => {
        // An application that only knows the first generation appends the event.
        firstGenerationClient = clientWith(artifactsWith({ eventTypes: [AuthorRegisteredV1] }));
        const firstGenerationStore = await firstGenerationClient.getEventStore(eventStoreName);
        // Keep a backlog so replay can overtake the asynchronous migration if the readiness barrier is removed.
        await firstGenerationStore.eventLog.appendMany(Array.from({ length: 500 }, () => ({
            eventSourceId: randomUUID(),
            event: Object.assign(new AuthorRegisteredV1(), { name: 'Earlier Author' })
        })));
        const appended = await firstGenerationStore.eventLog.append(eventSourceId, Object.assign(new AuthorRegisteredV1(), { name: 'Jane Doe' }));
        appendedSequenceNumber = appended.sequenceNumber.value;
        firstGenerationClient.dispose();

        // Registration starts a background migration job; it does not mean stored history has been migrated.
        // Wait for the target's second-generation content before any observer can replay the old payload.
        migrationClient = clientWith(artifactsWith({
            eventTypes: [AuthorRegisteredV1, AuthorRegistered],
            eventTypeMigrations: [AuthorRegisteredMigration]
        }));
        const migrationStore = await migrationClient.getEventStore(eventStoreName);
        event = await eventually(
            async () => (await migrationStore.eventLog.getForEventSourceIdAndEventTypes(eventSourceId, [AuthorRegistered]))[0],
            _ => {
                const content = _?.content as AuthorRegistered | undefined;
                return content?.firstName === 'Jane' && content.lastName === 'Doe';
            });
        migrationClient.dispose();

        // A later application replays the migrated history through a projection and a reactor.
        secondGenerationClient = clientWith(artifactsWith({
            eventTypes: [AuthorRegisteredV1, AuthorRegistered],
            eventTypeMigrations: [AuthorRegisteredMigration],
            readModels: [Author],
            reactors: [AuthorObserver]
        }));
        const store: IEventStore = await secondGenerationClient.getEventStore(eventStoreName);

        author = await eventually(() => store.readModels.findInstanceById(Author, eventSourceId), _ => _ !== null);
        observation = await eventually(async () => observed.find(_ => _.context.eventSourceId === eventSourceId)!, _ => _ !== undefined);

        // Registering a second generation without a migration from the first is rejected.
        const missingMigrationClient = clientWith(artifactsWith({ eventTypes: [AuthorRegisteredV1, AuthorRegistered] }));
        missingMigrationError = await missingMigrationClient.getEventStore(`Missing${randomUUID().replaceAll('-', '').slice(0, 12)}`).catch((error: unknown) => error);
        missingMigrationClient.dispose();
    });

    afterAll(() => {
        firstGenerationClient?.dispose();
        migrationClient?.dispose();
        secondGenerationClient?.dispose();
    });

    it('should read the first name split from the first generation', () => (event.content as AuthorRegistered).firstName.should.equal('Jane'));
    it('should read the last name split from the first generation', () => (event.content as AuthorRegistered).lastName.should.equal('Doe'));
    it('should keep the event source of the appended event', () => event.context.eventSourceId.should.equal(eventSourceId));
    it('should keep the sequence number of the appended event', () => event.context.sequenceNumber.should.equal(appendedSequenceNumber));
    it('should project the migrated first name', () => author!.should.have.property('firstName', 'Jane'));
    it('should project the migrated last name', () => author!.should.have.property('lastName', 'Doe'));
    it('should replay the migrated first name to the reactor', () => observation.event.should.have.property('firstName', 'Jane'));
    it('should replay the migrated last name to the reactor', () => observation.event.should.have.property('lastName', 'Doe'));
    it('should replay the event source to the reactor', () => observation.context.eventSourceId.should.equal(eventSourceId));
    it('should reject a second generation that has no migration', () => missingMigrationError.should.be.instanceOf(Error));
});
