// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient, ChronicleOptions, EventSequenceId, type EventEnrichmentProvider } from '../../../index.js';
import { EnrichedEvent } from './given.fixture.js';

chai.should();
const transport = vi.hoisted(() => ({
    register: vi.fn().mockResolvedValue({}),
    append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } })
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

for (const factory of [true, false]) {
    describe(`when configuring enrichment through the ${factory ? 'options factory' : 'options constructor'}`, () => {
        let client: ChronicleClient;
        beforeEach(async () => {
            vi.clearAllMocks();
            const providers: EventEnrichmentProvider[] = [content => { content.configured = true; }];
            const base = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
                skipKeepAlive: true, discoveryPatterns: [], eventEnrichmentProviders: providers,
                clientArtifactsProvider: {
                    eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [],
                    constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
                }
            });
            const options = factory ? base : new ChronicleOptions({
                connectionString: base.connectionString, skipKeepAlive: true, discoveryPatterns: [],
                clientArtifactsProvider: base.clientArtifactsProvider, eventEnrichmentProviders: providers
            });
            // Registration order belongs to the options, not the caller's mutable array.
            providers.reverse();
            providers.push(() => { throw new Error('must not be installed after configuration'); });
            client = new ChronicleClient(options);
            const store = await client.getEventStore('store', 'tenant');
            await store.eventLog.append('source', new EnrichedEvent());
            await store.getEventSequence(new EventSequenceId('custom')).append('source', new EnrichedEvent());
        });
        afterEach(() => client?.dispose());
        it('should enrich the event log and subsequently created event sequences', () => {
            transport.append.mock.calls.map(([request]) => JSON.parse(request.Content).configured).should.deep.equal([true, true]);
        });
        it('should retain each sequence identity', () => {
            transport.append.mock.calls.map(([request]) => request.EventSequenceId).should.deep.equal(['event-log', 'custom']);
        });
    });
}
