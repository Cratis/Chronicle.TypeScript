// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient, ChronicleOptions, ConcurrencyScopeStrategies, EventSequenceId } from '../../../index.js';
import { Deposited } from './given.fixture.js';

chai.should();
const transport = vi.hoisted(() => ({
    register: vi.fn().mockResolvedValue({}),
    append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n } })
}));
vi.mock('../../../connection/ChronicleConnection.js', () => ({
    ChronicleConnection: class {
        async resetChannel() {}
        async connect() {}
        async disconnect() {}
        server = { getVersionInfo: transport.register };
        eventStores = { ensureEventStore: transport.register };
        eventTypes = { register: transport.register };
        eventSources = { register: transport.register };
        constraints = { register: transport.register };
        projections = { register: transport.register };
        readModels = { registerMany: transport.register };
        webhooks = { register: transport.register };
        eventSeeding = { seed: transport.register };
        eventSequences = { append: transport.append };
    }
}));

describe('when configuring the concurrency scope strategy through client options', () => {
    let client: ChronicleClient | undefined;
    afterEach(() => client?.dispose());

    it('should default options to optimistic', () => {
        ChronicleOptions.fromConnectionString('chronicle://localhost:35000').concurrencyScopeStrategy.should.equal(ConcurrencyScopeStrategies.optimistic);
    });

    for (const strategy of [ConcurrencyScopeStrategies.none, vi.fn(() => ({ sequenceNumber: 11n }))]) {
        it('should carry the configured policy to the event log and later sequences', async () => {
            vi.clearAllMocks();
            const options = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
                skipKeepAlive: true, discoveryPatterns: [], concurrencyScopeStrategy: strategy,
                clientArtifactsProvider: {
                    eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [],
                    constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
                }
            });
            options.concurrencyScopeStrategy.should.equal(strategy);
            client = new ChronicleClient(options);
            const store = await client.getEventStore('store', 'tenant');
            await store.eventLog.append('source', new Deposited());
            await store.getEventSequence(new EventSequenceId('custom')).append('source', new Deposited());
            const expected = strategy === ConcurrencyScopeStrategies.none ? 18446744073709551615n : 11n;
            transport.append.mock.calls.map(([request]) => request.ConcurrencyScope.SequenceNumber).should.deep.equal([expected, expected]);
            transport.append.mock.calls.map(([request]) => request.EventSequenceId).should.deep.equal(['event-log', 'custom']);
            if (typeof strategy === 'function') strategy.mock.calls.should.have.length(2);
        });
    }
});
