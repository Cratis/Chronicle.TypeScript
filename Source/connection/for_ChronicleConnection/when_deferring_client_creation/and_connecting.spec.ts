// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { createServer, type ServiceImplementation } from 'nice-grpc';
import { ConnectionServiceDefinition } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import { ChronicleServerAddressResolver } from '../../ChronicleServerAddressResolver.js';
import { LeastConnectionsLoadBalancerStrategy } from '../../LeastConnectionsLoadBalancerStrategy.js';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import { reactor } from '../../../reactors/reactor.js';
import { ClientObserversRequireKeepAlive } from '../../ClientObserversRequireKeepAlive.js';

chai.should();
@reactor('preflight')
class Observer {}
let server: ReturnType<typeof createServer>;
let connection: ChronicleConnection;
let client: ChronicleClient;
let address: string;
let fetch: ReturnType<typeof vi.spyOn>;
let select: ReturnType<typeof vi.spyOn>;
let resolve: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
    server = createServer();
    const unused = async () => { throw new Error('Unexpected RPC'); };
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unused])),
        checkCompatibility: async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' })
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    const port = await server.listen('127.0.0.1:0');
    address = `chronicle://127.0.0.1:${port},127.0.0.1:1?disableTls=true`;
    fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(String(input).includes(`:${port}/`) ? '0' : '1'));
    select = vi.spyOn(LeastConnectionsLoadBalancerStrategy.prototype, 'select');
    resolve = vi.spyOn(ChronicleServerAddressResolver.prototype, 'resolve');
});
afterEach(async () => {
    client?.dispose();
    connection?.dispose();
    await server.shutdown();
    vi.restoreAllMocks();
});
describe('when deferring client creation', () => {
    it('should not resolve select probe or reserve before connecting', async () => {
        connection = new ChronicleConnection({ connectionString: address, deferClientCreation: true });
        await new Promise(resolve => setTimeout(resolve, 400));
        resolve.mock.calls.should.have.lengthOf(0);
        select.mock.calls.should.have.lengthOf(0);
        fetch.mock.calls.should.have.lengthOf(0);
    });
    it('should create one channel on connect and replace it unconditionally on reset', async () => {
        connection = new ChronicleConnection({ connectionString: address, deferClientCreation: true });
        await connection.connect();
        select.mock.calls.should.have.lengthOf(1);
        fetch.mock.calls.should.have.lengthOf(3);
        await connection.resetChannel();
        await connection.connect();
        select.mock.calls.should.have.lengthOf(2);
        fetch.mock.calls.should.have.lengthOf(6);
    });
    it('should eagerly create clients by default', async () => {
        connection = new ChronicleConnection({ connectionString: address });
        await new Promise(resolve => setTimeout(resolve, 400));
        select.mock.calls.should.have.lengthOf(1);
        fetch.mock.calls.should.have.lengthOf(3);
    });
    it('should refuse observers before even multi-host probes', async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(address, {
            skipKeepAlive: true, discoveryPatterns: [], clientArtifactsProvider: {
                eventTypes: [], reactors: [Observer], reducers: [], readModels: [], seeders: [], constraints: [],
                projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
            }
        }));
        const [result] = await Promise.allSettled([client.getEventStore('store')]);
        result.status.should.equal('rejected');
        if (result.status === 'rejected') result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
        await new Promise(resolve => setTimeout(resolve, 400));
        resolve.mock.calls.should.have.lengthOf(0);
        select.mock.calls.should.have.lengthOf(0);
        fetch.mock.calls.should.have.lengthOf(0);
    });
});
