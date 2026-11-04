// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { IClientArtifactsProvider } from '../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { fromEvent } from '../../projections/modelBound/fromEvent.js';
import { reactor } from '../../reactors/reactor.js';
import { reducer } from '../../reducers/reducer.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { ClientObserversRequireKeepAlive } from '../../connection/ClientObserversRequireKeepAlive.js';

chai.should();
const transport = vi.hoisted(() => ({
    constructor: vi.fn(), resetChannel: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    getVersionInfo: vi.fn(), ensureEventStore: vi.fn(), register: vi.fn(), observe: vi.fn(),
    allEventStores: vi.fn(), kernelConstructor: vi.fn(), start: vi.fn(),
    connectStream: vi.fn(), connectionKeepAlive: vi.fn(), registerModels: vi.fn(), registerProjection: vi.fn()
}));
vi.mock('../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        constructor(options: unknown) { transport.constructor(options); }
        resetChannel = transport.resetChannel;
        connect = transport.connect;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { ensureEventStore: transport.ensureEventStore, allEventStores: transport.allEventStores };
        eventTypes = new Proxy({}, { get: () => transport.register });
        constraints = new Proxy({}, { get: () => transport.register });
        projections = { register: transport.registerProjection };
        readModels = { registerMany: transport.registerModels };
        webhooks = new Proxy({}, { get: () => transport.register });
        eventSeeding = new Proxy({}, { get: () => transport.register });
        reactors = { observe: transport.observe };
        reducers = { observe: transport.observe };
        connections = { connect: transport.connectStream, connectionKeepAlive: transport.connectionKeepAlive };
    }
}));
vi.mock('../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class {
        constructor() { transport.kernelConstructor(); }
        start = transport.start;
    }
}));
@eventType('skip-item')
class Item {}
@fromEvent(Item)
class ItemModel {}
@reactor('skip-reactor')
class ItemReactor { item() {} }
@reducer('skip-reducer')
class ItemReducer { item() {} }

let client: ChronicleClient;
let artifacts: IClientArtifactsProvider;
let interval: ReturnType<typeof vi.spyOn>;
let timeout: ReturnType<typeof vi.spyOn>;
function create(skipKeepAlive = true, discoveryPatterns: string[] = []) {
    client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        skipKeepAlive, discoveryPatterns, clientArtifactsProvider: artifacts
    }));
    return client;
}
beforeEach(() => {
    vi.clearAllMocks();
    transport.ensureEventStore.mockResolvedValue({ IsAuthorized: true });
    transport.register.mockResolvedValue({});
    transport.registerModels.mockResolvedValue({});
    transport.registerProjection.mockResolvedValue({});
    transport.allEventStores.mockResolvedValue({ Data: [] });
    artifacts = { eventTypes: [Item], readModels: [ItemModel], reactors: [], reducers: [], seeders: [],
        constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] };
    interval = vi.spyOn(globalThis, 'setInterval');
    timeout = vi.spyOn(globalThis, 'setTimeout');
});
afterEach(() => { client?.dispose(); vi.restoreAllMocks(); });

describe('when skipping keep alive and connecting', () => {
    it('should connect and register event types and model-bound projections without streams or timers', async () => {
        await create().getEventStore('store');
        transport.constructor.mock.calls[0][0].deferClientCreation.should.be.true;
        transport.getVersionInfo.mock.calls.should.have.lengthOf(1);
        transport.register.mock.calls.length.should.be.greaterThan(0);
        transport.registerModels.mock.calls.length.should.be.greaterThan(0);
        transport.registerProjection.mock.calls.length.should.be.greaterThan(0);
        transport.kernelConstructor.mock.calls.should.have.lengthOf(0);
        transport.start.mock.calls.should.have.lengthOf(0);
        transport.connectStream.mock.calls.should.have.lengthOf(0);
        transport.connectionKeepAlive.mock.calls.should.have.lengthOf(0);
        interval.mock.calls.should.have.lengthOf(0);
        timeout.mock.calls.should.have.lengthOf(0);
    });
    it('should preserve the default watchdog and keep alive', async () => {
        await create(false).getEventStore('store');
        Boolean(transport.constructor.mock.calls[0][0].deferClientCreation).should.be.false;
        transport.kernelConstructor.mock.calls.should.have.lengthOf(1);
        transport.start.mock.calls.should.have.lengthOf(1);
        interval.mock.calls.some(call => call[1] === 5000).should.be.true;
    });
    it('should reconnect unary calls without starting keep alive', async () => {
        transport.allEventStores.mockRejectedValueOnce({ code: 14 });
        await create().getEventStores();
        transport.resetChannel.mock.calls.should.have.lengthOf(2);
        transport.getVersionInfo.mock.calls.should.have.lengthOf(2);
        transport.kernelConstructor.mock.calls.should.have.lengthOf(0);
        interval.mock.calls.should.have.lengthOf(0);
    });
    it('should dispose before connecting and repeatedly without starting anything', async () => {
        create().dispose();
        client.dispose();
        const [result] = await Promise.allSettled([client.getEventStore('store')]);
        result.status.should.equal('rejected');
        for (const spy of [transport.resetChannel, transport.connect, transport.getVersionInfo,
            transport.connectStream, transport.connectionKeepAlive, transport.kernelConstructor, interval, timeout]) {
            spy.mock.calls.should.have.lengthOf(0);
        }
    });
    it('should dispose repeatedly after connecting without starting streams or timers', async () => {
        await create().getEventStore('store');
        client.dispose();
        client.dispose();
        transport.connect.mock.calls.should.have.lengthOf(1);
        transport.resetChannel.mock.calls.should.have.lengthOf(1);
        for (const spy of [transport.connectStream, transport.connectionKeepAlive, transport.kernelConstructor, interval, timeout]) {
            spy.mock.calls.should.have.lengthOf(0);
        }
    });
    for (const [kind, type, id] of [['Reactor', ItemReactor, 'skip-reactor'], ['Reducer', ItemReducer, 'skip-reducer']] as const) {
        it(`should refuse a ${kind} before any transport side effects on repeated retrieval`, async () => {
            artifacts[kind === 'Reactor' ? 'reactors' : 'reducers'].push(type);
            create();
            for (let attempt = 0; attempt < 2; attempt++) {
                const [result] = await Promise.allSettled([client.getEventStore('store')]);
                result.status.should.equal('rejected');
                if (result.status === 'rejected') {
                    result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
                    result.reason.observerKind.should.equal(kind);
                    result.reason.observerId.should.equal(id);
                    result.reason.name.should.equal('ClientObserversRequireKeepAlive');
                }
            }
            for (const spy of [transport.resetChannel, transport.connect, transport.getVersionInfo,
                transport.ensureEventStore, transport.register, transport.observe]) spy.mock.calls.should.have.lengthOf(0);
        });
    }
    it('should await discovery before refusing an observer', async () => {
        vi.spyOn(TypeDiscoverer.default, 'discover').mockImplementation(async () => {
            await Promise.resolve();
            artifacts.reactors.push(ItemReactor);
        });
        const [result] = await Promise.allSettled([create(true, ['fixture']).getEventStore('store')]);
        result.status.should.equal('rejected');
        if (result.status === 'rejected') result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
        transport.resetChannel.mock.calls.should.have.lengthOf(0);
    });
});
