// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import { reactor } from '../../reactor.js';
import { startAtTail } from '../../startAtTail.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class SomethingHappenedBeforeRegistration {
    @field(String) name = '';
}

// The client constructs reactor instances; share sinks for assertions across that boundary.
const fromTheTail: string[] = [];
const fromTheBeginning: string[] = [];

@reactor()
@startAtTail()
class TailReactor {
    somethingHappenedBeforeRegistration(event: SomethingHappenedBeforeRegistration) { fromTheTail.push(event.name); }
}

// The control: the same registration without the marker catches up on all history.
@reactor()
class HistoryReactor {
    somethingHappenedBeforeRegistration(event: SomethingHappenedBeforeRegistration) { fromTheBeginning.push(event.name); }
}

const artifactsWith = (reactors: Function[]): IClientArtifactsProvider => ({
    eventTypes: [SomethingHappenedBeforeRegistration],
    readModels: [],
    reactors,
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
});

async function eventually(accept: () => boolean, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!accept()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

describe.skipIf(!connectionString && !process.env.CI)('when registering a reactor marked to start at the tail against a kernel', () => {
    const storeName = `StartAtTail${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const clients: ChronicleClient[] = [];

    const newClient = (reactors: Function[]) => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifactsWith(reactors)
        }));
        clients.push(client);
        return client;
    };

    beforeAll(async () => {
        // History exists before either reactor has ever been registered.
        const writer = await newClient([]).getEventStore(storeName);
        for (const name of ['one', 'two', 'three']) {
            const appended = await writer.eventLog.append(randomUUID(), Object.assign(new SomethingHappenedBeforeRegistration(), { name }));
            appended.isSuccess.should.be.true;
        }

        const reader = await newClient([TailReactor, HistoryReactor]).getEventStore(storeName);

        // The control proves the history was deliverable, so the tail reactor's silence is not vacuous.
        await eventually(() => fromTheBeginning.length === 3);

        const appended = await reader.eventLog.append(randomUUID(), Object.assign(new SomethingHappenedBeforeRegistration(), { name: 'after' }));
        appended.isSuccess.should.be.true;
        await eventually(() => fromTheTail.length === 1 && fromTheBeginning.length === 4);
    });

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should not deliver history that predates its registration', () => {
        fromTheTail.should.not.include.members(['one', 'two', 'three']);
    });

    it('should deliver what is appended afterwards', () => {
        fromTheTail.should.deep.equal(['after']);
    });

    it('should leave a reactor that is not marked to catch up on all history', () => {
        // Each event has its own event source, so the kernel may deliver the partitions in any order.
        [...fromTheBeginning].sort().should.deep.equal(['after', 'one', 'three', 'two']);
    });
});
