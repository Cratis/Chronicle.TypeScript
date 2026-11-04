// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient, ChronicleOptions, eventType, fromEvent, reactor, reducer, ClientObserversRequireKeepAlive,
    type IClientArtifactsProvider, type IEventStore } from '../../index.js';
import { ChronicleConnection } from '../../connection/ChronicleConnection.js';

chai.should();
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;
@eventType('skip-integration-item')
class Item { @field(String) value = ''; }
@fromEvent(Item)
class Model { @field(String) value = ''; }
@reactor('skip-integration-reactor')
class Observer {}
@reducer('skip-integration-reducer')
class Reducer {}
const artifacts = (): IClientArtifactsProvider => ({ eventTypes: [Item], readModels: [Model], reactors: [], reducers: [],
    constraints: [], projections: [], seeders: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] });
const connections: ChronicleClient[] = [];
function create(skipKeepAlive: boolean, provider = artifacts()) {
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
        skipKeepAlive, discoveryPatterns: [], clientArtifactsProvider: provider
    }));
    connections.push(client);
    return client;
}
function transport(client: ChronicleClient) {
    return (client as unknown as { _connection: ChronicleConnection })._connection;
}

describe.skipIf(!connectionString)('when skipping keep alive against a kernel', () => {
    let client: ChronicleClient;
    let store: IEventStore;
    // MongoDB caps database names at 63 bytes, and the kernel appends '+es+<namespace>' to the event store name.
    const name = `skip-${randomUUID().slice(0, 8)}`;
    beforeAll(async () => { client = create(true); store = await client.getEventStore(name); }, 30_000);
    afterAll(() => connections.forEach(client => client.dispose()));
    it('should append and query without a connected-client entry', async () => {
        const item = new Item();
        item.value = randomUUID();
        await store.eventLog.append(randomUUID(), item);
        (await store.eventLog.getTailSequenceNumber()).value.should.be.greaterThanOrEqual(0n);
        const after = await transport(client).connections.getConnectedClients({});
        const id = (client as unknown as { _lifecycle: { connectionId: string } })._lifecycle.connectionId;
        after.items.some(entry => entry.ConnectionId === id).should.be.false;
    });
    it('should leave read model watch streams available', async () => {
        const watcher = store.readModels.createWatcher(Model);
        try { await watcher.subscribed; } finally { watcher.dispose(); }
    });
    for (const kind of ['reactors', 'reducers'] as const) {
        it(`should refuse ${kind} without creating a store`, async () => {
            const provider = artifacts();
            provider[kind].push(kind === 'reactors' ? Observer : Reducer);
            const candidate = create(true, provider);
            const [result] = await Promise.allSettled([candidate.getEventStore(`refused-${randomUUID().slice(0, 8)}`)]);
            result.status.should.equal('rejected');
            if (result.status === 'rejected') result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
        });
    }
    it('should retain the default connected-client entry', async () => {
        const candidate = create(false, { ...artifacts(), readModels: [] });
        await candidate.getEventStore(`${name}-default`);
        const id = (candidate as unknown as { _lifecycle: { connectionId: string } })._lifecycle.connectionId;
        const clients = await transport(candidate).connections.getConnectedClients({});
        clients.items.some(entry => entry.ConnectionId === id).should.be.true;
    });
    it('should exit naturally in plain Node only when keep alive is skipped', async () => {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, ['scripts/check-skip-keepalive-exit.mjs'], { stdio: 'inherit' });
            child.once('error', reject);
            child.once('exit', (code, signal) => code === 0 && !signal ? resolve() : reject(new Error(`Native probe failed: ${code}/${signal}`)));
        });
    }, 90_000);
});
