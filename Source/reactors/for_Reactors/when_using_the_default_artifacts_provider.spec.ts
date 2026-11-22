// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { EventStore } from '../../EventStore.js';
import { EventStoreName } from '../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../EventStoreNamespaceName.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { DecoratorType } from '../../types/DecoratorType.js';
import { reactor } from '../reactor.js';
import { runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

for (const scenario of ['discovery duplicate', 'runtime duplicate', 'runtime discovery collision', 'mixed reconnect', 'removal during reconnect'] as const) {
    describe(`when using the default artifacts provider for ${scenario}`, () => {
        let context: runtime_reactors;
        let client: ChronicleClient;
        let store: EventStore;
        let failure: unknown;
        beforeEach(async () => {
            TypeDiscoverer.default.clear();
            context = new runtime_reactors();
            @eventType('real-added')
            class Added {}
            @reactor('real-discovered')
            class Discovered { added() {} }
            const register = vi.fn().mockResolvedValue({});
            const connection = new Proxy({}, {
                get: (_target, service) => {
                    if (service === 'logger') return undefined;
                    if (service === 'reactors') return { observe: context.observe };
                    return new Proxy({}, { get: () => register });
                }
            }) as ChronicleConnection;
            client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
            store = new EventStore(new EventStoreName('store'), EventStoreNamespaceName.default, connection, client['_lifecycle'], 'sink', DefaultClientArtifactsProvider.default);
            client['_stores'].set('store', store);
            const runtime = () => store.reactors.register('runtime', builder => builder.on(Added, () => {}));
            try {
                if (scenario === 'discovery duplicate') {
                    @reactor('real-discovered')
                    class Duplicate { added() {} }
                    TypeDiscoverer.default.register(DecoratorType.Reactor, Discovered, 'first-discovery-key');
                    TypeDiscoverer.default.register(DecoratorType.Reactor, Duplicate, 'second-discovery-key');
                    await store.reactors.register();
                } else if (scenario === 'runtime duplicate') {
                    const first = runtime();
                    const second = runtime();
                    await first;
                    await second;
                } else if (scenario === 'runtime discovery collision') {
                    await store.reactors.register('real-discovered', builder => builder.on(Added, () => {}));
                } else {
                    await runtime();
                    await store.reactors.register();
                    if (scenario === 'removal during reconnect') await store.reactors.unregister('runtime');
                    await client['_lifecycle'].disconnected(error => { throw error; });
                    await client['_lifecycle'].connected(error => { throw error; });
                    await store.reactors.register();
                }
            } catch (error) { failure = error; }
        });
        afterEach(() => {
            store.disposeObservations(); client.dispose(); context.reactors.dispose(); TypeDiscoverer.default.clear();
        });
        if (scenario.includes('duplicate') || scenario.includes('collision')) {
            it('should reject rather than overwrite the identity', () => (failure as Error).message.should.match(/already registered/));
            it('should open no streams for the invalid batch', () => context.observe.mock.calls.length.should.equal(scenario === 'runtime duplicate' ? 1 : 0));
        } else {
            it('should use cached EventStore lifecycle restoration exactly once', () => context.observe.mock.calls.length.should.equal(scenario === 'mixed reconnect' ? 4 : 3));
            it('should cancel the previous observations', () => context.attempts[0].signal.aborted.should.be.true);
        }
    });
}
