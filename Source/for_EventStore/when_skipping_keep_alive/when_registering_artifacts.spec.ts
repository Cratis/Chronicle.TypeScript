// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { EventStore } from '../../EventStore.js';
import { EventStoreName } from '../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../EventStoreNamespaceName.js';
import { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import { ClientObserversRequireKeepAlive } from '../../connection/ClientObserversRequireKeepAlive.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { fromEvent } from '../../projections/modelBound/fromEvent.js';
import { reactor } from '../../reactors/reactor.js';

chai.should();
@eventType('store-skip-item')
class Item {}
@fromEvent(Item)
class Model {}
@reactor('store-skip-reactor')
class Observer { item() {} }

describe('when registering store artifacts while skipping keep alive', () => {
    for (const withObserver of [true, false]) {
        it(`should ${withObserver ? 'refuse observers before registration' : 'allow projections read models and watchers'}`, async () => {
            const register = vi.fn().mockResolvedValue({});
            const watch = vi.fn().mockImplementation(async function* () {});
            const connection = new Proxy({}, { get: (_target, property) => property === 'logger' ? undefined
                : new Proxy({}, { get: (_service, method) => method === 'watch' ? watch : register }) }) as ChronicleConnection;
            const lifecycle = new ConnectionLifecycle();
            const store = new EventStore(new EventStoreName('store'), EventStoreNamespaceName.default, connection, lifecycle, 'sink', {
                eventTypes: [Item], readModels: [Model], reactors: withObserver ? [Observer] : [], reducers: [], seeders: [],
                constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
            }, undefined, undefined, undefined, undefined, true);
            try {
                const [result] = await Promise.allSettled([store.registerArtifacts()]);
                result.status.should.equal(withObserver ? 'rejected' : 'fulfilled');
                if (result.status === 'rejected') {
                    result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
                    register.mock.calls.should.have.lengthOf(0);
                } else {
                    register.mock.calls.length.should.be.greaterThan(0);
                    await lifecycle.connected(() => {});
                    const watcher = store.readModels.createWatcher(Model);
                    watch.mock.calls.should.have.lengthOf(1);
                    watcher.dispose();
                }
            } finally { store.disposeObservations(); }
        });
    }
});
