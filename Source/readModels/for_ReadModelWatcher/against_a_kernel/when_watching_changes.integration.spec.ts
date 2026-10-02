// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import { fromEvent, removedWith } from '../../../projections/index.js';
import type { IReadModelWatcher } from '../../IReadModelWatcher.js';
import type { ReadModelChangeset } from '../../ReadModelChangeset.js';
import { ReadModelChangeType } from '../../ReadModelChangeType.js';

chai.should();
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class NameChanged {
    @field(String) name = '';
}

@eventType()
class EntryRemoved {
    @field(String) reason = 'removed';
}

@fromEvent(NameChanged)
@removedWith(EntryRemoved)
class WatchedEntry {
    @field(String) name = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [NameChanged, EntryRemoved], readModels: [WatchedEntry],
    projections: [], reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [],
    eventTypeMigrations: [], globalForHandlers: []
};

describe.skipIf(!connectionString && !process.env.CI)('when awaiting readiness before appending against a kernel', () => {
    const storeName = `Watcher${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const source = randomUUID();
    const correlationIds = [randomUUID(), randomUUID(), randomUUID()];
    const occurred = new Date('2026-01-02T03:04:05.123Z');
    const changes: ReadModelChangeset<WatchedEntry>[] = [];
    const sequenceNumbers: bigint[] = [];
    let client: ChronicleClient;
    let watcher: IReadModelWatcher<WatchedEntry>;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        const store = await client.getEventStore(storeName);
        watcher = store.readModels.createWatcher(WatchedEntry, { signal: AbortSignal.timeout(60_000) });
        // No iteration, arbitrary sleep, or append before the server's readiness barrier.
        await watcher.subscribed;
        const iterator = watcher[Symbol.asyncIterator]();
        const events = [Object.assign(new NameChanged(), { name: 'first' }),
            Object.assign(new NameChanged(), { name: 'second' }), new EntryRemoved()];
        for (const [index, event] of events.entries()) {
            const result = await store.eventLog.append(source, event, { correlationId: correlationIds[index], occurred });
            result.isSuccess.should.be.true;
            sequenceNumbers.push(result.sequenceNumber.value);
            const change = await iterator.next();
            if (change.done) throw new Error('Watcher ended before the appended change arrived.');
            changes.push(change.value);
        }
    });
    afterAll(() => {
        watcher?.dispose();
        client?.dispose();
    });

    it('should observe creation, modification, and removal in order', () => {
        changes.map(change => change.changeType).should.deep.equal([
            ReadModelChangeType.Added, ReadModelChangeType.Modified, ReadModelChangeType.Removed
        ]);
    });
    it('should preserve the existing model, key, namespace and removal fields', () => {
        changes[0].readModel.should.be.instanceOf(WatchedEntry);
        changes[0].readModel.name.should.equal('first');
        changes[1].readModel.name.should.equal('second');
        changes.map(change => change.key).should.deep.equal([source, source, source]);
        changes.map(change => change.namespace).should.deep.equal(['Default', 'Default', 'Default']);
        changes.map(change => change.removed).should.deep.equal([false, false, true]);
    });
    it('should preserve each triggering sequence number without numeric conversion', () => {
        changes.map(change => change.changeContext!.sequenceNumber).should.deep.equal(sequenceNumbers);
    });
    it('should preserve each triggering correlation identifier', () => {
        changes.map(change => change.changeContext!.correlationId).should.deep.equal(correlationIds);
    });
    it('should preserve each triggering timestamp', () => {
        changes.map(change => change.changeContext!.occurred!.toISOString()).should.deep.equal([
            occurred.toISOString(), occurred.toISOString(), occurred.toISOString()
        ]);
    });
    it('should include the store and namespace in the triggering context', () => {
        changes.every(change => change.changeContext!.eventStore === storeName &&
            change.changeContext!.namespace === 'Default').should.be.true;
    });
});
