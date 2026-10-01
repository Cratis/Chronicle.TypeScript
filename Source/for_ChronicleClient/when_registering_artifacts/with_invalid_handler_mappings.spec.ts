// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles } from '../../events/handles.js';
import { reactor, replay } from '../../reactors/index.js';
import { reducer } from '../../reducers/index.js';

chai.should();

const transport = vi.hoisted(() => ({
    ensureEventStore: vi.fn(),
    register: vi.fn(),
    observe: vi.fn()
}));

vi.mock('../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        async resetChannel() {}
        async connect() {}
        disconnect() {}
        server = { getVersionInfo: async () => ({}) };
        eventStores = { ensureEventStore: transport.ensureEventStore };
        eventTypes = new Proxy({}, { get: () => transport.register });
        constraints = new Proxy({}, { get: () => transport.register });
        projections = new Proxy({}, { get: () => transport.register });
        readModels = new Proxy({}, { get: () => transport.register });
        webhooks = new Proxy({}, { get: () => transport.register });
        eventSeeding = new Proxy({}, { get: () => transport.register });
        reactors = { observe: transport.observe };
        reducers = { observe: transport.observe };
    }
}));
vi.mock('../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class { async start() {} }
}));

@eventType('preflight-author')
class AuthorRegistered {}
@eventType('preflight-missing')
class Unregistered {}

@reactor('valid-reactor')
class ValidReactor { @handles(AuthorRegistered) notify() {} }
@reducer('valid-reducer')
class ValidReducer { @handles(AuthorRegistered) update() {} }

@reactor('missing-event')
class MissingReactor { @handles(Unregistered) notify() {} }
@reactor('duplicate-event')
class DuplicateReactor {
    @handles(AuthorRegistered) notify() {}
    authorRegistered() {}
}
@reactor('ambiguous-replay')
class AmbiguousReactor { @replay(AuthorRegistered) @handles(AuthorRegistered) notify() {} }

@reducer('missing-event')
class MissingReducer { @handles(Unregistered) update() {} }
@reducer('duplicate-event')
class DuplicateReducer {
    @handles(AuthorRegistered) update() {}
    authorRegistered() {}
}

for (const [kind, type, message] of [
    ['reactor', MissingReactor, /notify.*MissingReactor.*Unregistered.*no registered event type/],
    ['reactor', DuplicateReactor, /multiple handlers.*preflight-author.*notify.*authorRegistered/],
    ['reactor', AmbiguousReactor, /notify.*AmbiguousReactor.*cannot combine @handles and @replay/],
    ['reducer', MissingReducer, /update.*MissingReducer.*Unregistered.*no registered event type/],
    ['reducer', DuplicateReducer, /multiple handlers.*preflight-author.*update.*authorRegistered/]
] as const) {
    describe(`when getting an event store with invalid mappings on ${type.name}`, () => {
        let client: ChronicleClient;
        let artifacts: IClientArtifactsProvider;
        let result: PromiseSettledResult<unknown>;
        let disconnectedSubscriptions: Set<unknown>;
        let clientSubscriptionCount: number;
        beforeEach(async () => {
            vi.clearAllMocks();
            disconnectedSubscriptions = new Set();
            const onDisconnected = ConnectionLifecycle.prototype.onDisconnected;
            vi.spyOn(ConnectionLifecycle.prototype, 'onDisconnected').mockImplementation(function (this: ConnectionLifecycle, handler) {
                disconnectedSubscriptions.add(handler);
                const unsubscribe = onDisconnected.call(this, handler);
                return () => { unsubscribe(); disconnectedSubscriptions.delete(handler); };
            });
            transport.ensureEventStore.mockResolvedValue({ IsAuthorized: true });
            transport.register.mockResolvedValue({});
            transport.observe.mockImplementation(async function* () {
                yield { Events: [], Partition: '', ReplayState: 0, InitialState: '' };
            });
            artifacts = {
                reactors: kind === 'reactor' ? [ValidReactor, type] : [ValidReactor],
                reducers: kind === 'reducer' ? [ValidReducer, type] : [ValidReducer],
                eventTypes: [AuthorRegistered], readModels: [], projections: [], constraints: [],
                webhooks: [], seeders: [], eventTypeMigrations: [], globalForHandlers: []
            };
            client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
                discoveryPatterns: [], clientArtifactsProvider: artifacts
            }));
            clientSubscriptionCount = disconnectedSubscriptions.size;
            [result] = await Promise.allSettled([client.getEventStore('store')]);
        });
        afterEach(() => { client.dispose(); vi.restoreAllMocks(); });

        it('should reject getEventStore with the handler validation error', () => {
            result.status.should.equal('rejected');
            if (result.status === 'rejected') (result.reason as Error).message.should.match(message);
        });
        it('should leave no discarded-store lifecycle subscriptions after either failed retrieval', async () => {
            disconnectedSubscriptions.size.should.equal(clientSubscriptionCount);
            await Promise.allSettled([client.getEventStore('store')]);
            disconnectedSubscriptions.size.should.equal(clientSubscriptionCount);
        });
        it('should not register any artifacts or begin observations', () => {
            transport.register.mock.calls.should.have.lengthOf(0);
            transport.observe.mock.calls.should.have.lengthOf(0);
        });
        it('should reject a second retrieval instead of returning the failed store', async () => {
            const [retry] = await Promise.allSettled([client.getEventStore('store')]);
            retry.status.should.equal('rejected');
            if (retry.status === 'rejected') (retry.reason as Error).message.should.match(message);
            transport.register.mock.calls.should.have.lengthOf(0);
            transport.observe.mock.calls.should.have.lengthOf(0);
        });
        it('should register a fresh store after the invalid mapping is removed and cache only that store', async () => {
            artifacts.reactors.splice(1);
            artifacts.reducers.splice(1);
            const store = await client.getEventStore('store');
            transport.register.mock.calls.length.should.be.greaterThan(0);
            transport.observe.mock.calls.should.have.lengthOf(2);
            (await client.getEventStore('store')).should.equal(store);
            transport.ensureEventStore.mock.calls.should.have.lengthOf(2);
        });
    });
}
