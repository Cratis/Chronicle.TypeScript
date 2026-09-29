// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { AppendedEvent } from '../../../events/index.js';
import { eventType } from '../../../events/index.js';
import type { AppendResult } from '../../../eventSequences/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { fromEvent } from '../../../projections/index.js';
import { reducer } from '../../../reducers/index.js';
import { pii } from '../../pii.js';
import { subject } from '../../subject.js';

chai.should();

// Runs against a real Chronicle kernel; skipped unless the connection string is set (see vitest.integration.config.ts).
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class PersonRegistered {
    @field(String) personId = '';
    @pii('The name of the person') @field(String) name = '';
    @field(String) department = '';
}

// Projected by the kernel. The kernel encrypts from the read model's own schema, so the property is marked @pii here too.
@fromEvent(PersonRegistered)
class RegisteredPerson {
    @pii('The name of the person') @field(String) name = '';
    @field(String) department = '';
}

// Reduced in the client. @subject() tells release() which person's key protects the name.
class PersonCard {
    @subject() @field(String) personId = '';
    @pii('The name of the person') @field(String) name = '';
}

@reducer('', undefined, PersonCard)
class PersonCardReducer {
    personRegistered(event: PersonRegistered): PersonCard {
        return Object.assign(new PersonCard(), { personId: event.personId, name: event.name });
    }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [PersonRegistered],
    readModels: [RegisteredPerson, PersonCard],
    reactors: [],
    reducers: [PersonCardReducer],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for the kernel; last value: ${JSON.stringify(value)}`);
        await new Promise(resolve => setTimeout(resolve, 250));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString)('when erasing a subject against a kernel', () => {
    const name = 'Eve Jackson';
    const eventSourceId = randomUUID();
    const personId = randomUUID();
    let client: ChronicleClient;
    let store: IEventStore;
    let appended: AppendResult;
    let eventBefore: AppendedEvent;
    let projectedBefore: RegisteredPerson | null;
    let reducedBefore: PersonCard | null;
    let eventAfter: AppendedEvent;
    let projectedAfter: RegisteredPerson | null;
    let reducedAfter: PersonCard | null;
    let appendedAfterErasure: AppendResult;
    let releaseWithoutSubject: unknown;

    const readEvent = async () => (await store.eventLog.getForEventSourceIdAndEventTypes(eventSourceId, [PersonRegistered]))[0];

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`PiiEndToEnd${randomUUID().replaceAll('-', '')}`);

        // The event source is the registration; the explicit subject is the person the PII belongs to.
        appended = await store.eventLog.append(eventSourceId, Object.assign(new PersonRegistered(), { personId, name, department: 'Accounting' }), { subject: personId });

        eventBefore = await readEvent();
        projectedBefore = await eventually(() => store.readModels.findInstanceById(RegisteredPerson, eventSourceId), _ => _ !== null);
        reducedBefore = await eventually(() => store.readModels.findInstanceById(PersonCard, eventSourceId), _ => _ !== null);

        await store.pii.deleteEncryptionKey(personId);

        eventAfter = await readEvent();
        projectedAfter = await store.readModels.findInstanceById(RegisteredPerson, eventSourceId);
        reducedAfter = await store.readModels.findInstanceById(PersonCard, eventSourceId);
        appendedAfterErasure = await store.eventLog.append(randomUUID(), Object.assign(new PersonRegistered(), { personId, name, department: 'Accounting' }), { subject: personId });
        releaseWithoutSubject = await store.readModels.release(RegisteredPerson, projectedAfter!).catch((error: unknown) => error);
    });

    afterAll(() => client?.dispose());

    it('should append the event', () => appended.isSuccess.should.be.true);
    it('should record the explicit subject on the event', () => eventBefore.context.subject!.should.equal(personId));
    it('should read the event released', () => eventBefore.content.name!.should.equal(name));
    it('should read the projected read model released', () => projectedBefore!.name.should.equal(name));
    it('should read the reduced read model released', () => reducedBefore!.name.should.equal(name));

    it('should no longer reveal the name in the event', () => eventAfter.content.name!.should.not.equal(name));
    it('should keep the data that is not personal in the event', () => eventAfter.content.department!.should.equal('Accounting'));
    it('should no longer reveal the name in the projected read model', () => projectedAfter!.name.should.not.equal(name));
    it('should keep the data that is not personal in the projected read model', () => projectedAfter!.department.should.equal('Accounting'));
    it('should no longer reveal the name in the reduced read model', () => reducedAfter!.name.should.not.equal(name));
    it('should reject new personal data for the erased subject', () => appendedAfterErasure.isSuccess.should.be.false);
    it('should report a release that has no subject instead of returning the data', () => releaseWithoutSubject.should.be.instanceOf(Error));
});
