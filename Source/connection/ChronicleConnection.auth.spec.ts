// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, ServerError, type ServiceImplementation } from 'nice-grpc';
import { ConnectionServiceDefinition, EventStoresDefinition, ServerDefinition } from '@cratis/chronicle.contracts';
import { status } from '@grpc/grpc-js';
import { ChronicleConnection } from './ChronicleConnection.js';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';
import { OAuthTokenHttpError } from './fetchOAuthAccessToken.js';
import { RejectedChronicleCredentials } from './RejectedChronicleCredentials.js';
import { ClientError } from 'nice-grpc-common';

const fetchToken = vi.hoisted(() => vi.fn());
vi.mock('./fetchOAuthAccessToken.js', async importOriginal => ({ ...await importOriginal<typeof import('./fetchOAuthAccessToken.js')>(), fetchOAuthAccessToken: fetchToken }));
vi.mock('./KernelKeepAlive.js', () => ({ KernelKeepAlive: class { async start() {} } }));

const servers: Array<ReturnType<typeof createServer>> = [];
const connections: ChronicleConnection[] = [];
const clients: ChronicleClient[] = []; 

async function listen(rejectAnonymous = false): Promise<number> {
    const server = createServer();
    const unsupported = async () => { throw new Error('Unexpected RPC'); };
    const methods = Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unsupported]));
    server.add(ConnectionServiceDefinition, {
        ...methods, checkCompatibility: async () => {
            if (rejectAnonymous) throw new ServerError(status.UNAUTHENTICATED, 'Unauthenticated');
            return { IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' };
        }
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    servers.push(server);
    return server.listen('127.0.0.1:0');
}

async function listenAuthenticated(onCheck?: () => void): Promise<number> {
    const server = createServer();
    const authenticate = async (_request: unknown, context: { metadata: { get(key: string): string | undefined } }) => {
        if (context.metadata.get('authorization') !== 'Bearer fresh' &&
            context.metadata.get('api-key') !== 'valid') throw new ServerError(status.UNAUTHENTICATED, 'Unauthenticated');
    };
    const unsupported = async () => { throw new Error('Unexpected RPC'); };
    server.add(ConnectionServiceDefinition, {
        ...Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unsupported])),
        checkCompatibility: async (request, context) => {
            onCheck?.();
            await authenticate(request, context);
            return { IsCompatible: true, Incompatibilities: [], ServerVersion: 'test' };
        }
    } as ServiceImplementation<typeof ConnectionServiceDefinition>);
    server.add(ServerDefinition, {
        getVersionInfo: async () => ({}), resetKernelState: unsupported
    } as ServiceImplementation<typeof ServerDefinition>);
    server.add(EventStoresDefinition, {
        allEventStores: async () => ({ IsAuthorized: true, Data: [] }),
        ensureEventStore: unsupported, observeEventStores: unsupported
    } as ServiceImplementation<typeof EventStoresDefinition>);
    servers.push(server);
    return server.listen('127.0.0.1:0');
}

afterEach(async () => {
    for (const client of clients) client.dispose();
    for (const connection of connections) connection.dispose();
    for (const server of servers) await server.shutdown();
    connections.length = 0;
    clients.length = 0;
    servers.length = 0;
    fetchToken.mockReset();
    vi.useRealTimers();
});

describe('ChronicleConnection authentication', () => {
    it('uses the selected server for credentials and reuses a token when returning to that server', async () => {
        const first = await listen();
        const second = await listen();
        fetchToken.mockImplementation(async (endpoint: string) => ({ access_token: endpoint, expires_in: 3600 }));
        const connection = new ChronicleConnection({ connectionString: `chronicle://user:secret@127.0.0.1:${first},127.0.0.1:${second}?disableTls=true&loadBalancer=round-robin` });
        connections.push(connection);

        await connection.connect();
        await connection.reconnect();
        await connection.reconnect();

        expect(fetchToken.mock.calls.map(call => call[0]).sort()).toEqual([
            `http://127.0.0.1:${first}/connect/token`,
            `http://127.0.0.1:${second}/connect/token`
        ].sort());
    });

    it('keeps an explicit authority across server selections', async () => {
        const first = await listen();
        const second = await listen();
        fetchToken.mockResolvedValue({ access_token: 'token', expires_in: 3600 });
        const connection = new ChronicleConnection({
            connectionString: `chronicle://user:secret@127.0.0.1:${first},127.0.0.1:${second}?disableTls=true&loadBalancer=round-robin`,
            authority: 'http://identity.example:1234'
        });
        connections.push(connection);

        await connection.connect();
        await connection.reconnect();
        expect(fetchToken).toHaveBeenCalledTimes(1);
        expect(fetchToken.mock.calls[0][0]).toBe('http://identity.example:1234/connect/token');
    });

    it('includes the token endpoint failure when the unauthenticated RPC is rejected', async () => {
        const port = await listen(true);
        fetchToken.mockRejectedValue(new Error('invalid_client'));
        const connection = new ChronicleConnection({ connectionString: `chronicle://wrong:wrong@127.0.0.1:${port}?disableTls=true` });
        connections.push(connection);
        await expect(connection.connect()).rejects.toThrow(`http://127.0.0.1:${port}/connect/token: invalid_client`);
    });

    it('preserves the gRPC code, path and original error on a token failure', async () => {
        const port = await listen(true);
        fetchToken.mockRejectedValue(new OAuthTokenHttpError(401, '{"error":"invalid_client"}'));
        const connection = new ChronicleConnection({ connectionString: `chronicle://wrong:wrong@127.0.0.1:${port}?disableTls=true` });
        connections.push(connection);
        const error = await connection.connect().catch(error => error as ClientError);
        expect(error).toBeInstanceOf(ClientError);
        expect(error.code).toBe(status.UNAUTHENTICATED);
        expect(error.path).toContain('CheckCompatibility');
        expect(error.details).toContain('invalid_client');
        expect(error.cause).toBeInstanceOf(ClientError);
    });

    it('refreshes a rejected cached token and retries one unary call', async () => {
        const port = await listenAuthenticated();
        fetchToken.mockResolvedValueOnce({ access_token: 'stale', expires_in: 3600 })
            .mockResolvedValueOnce({ access_token: 'fresh', expires_in: 3600 });
        const connection = new ChronicleConnection({ connectionString: `chronicle://user:secret@127.0.0.1:${port}?disableTls=true` });
        connections.push(connection);
        await expect(connection.connect()).resolves.toBeUndefined();
        expect(fetchToken).toHaveBeenCalledTimes(2);
    });

    it('connects after two startup invalid_client responses', async () => {
        const port = await listenAuthenticated();
        fetchToken.mockRejectedValueOnce(new OAuthTokenHttpError(401, '{"error":"invalid_client"}'))
            .mockRejectedValueOnce(new OAuthTokenHttpError(401, '{"error":"invalid_client"}'))
            .mockResolvedValue({ access_token: 'fresh', expires_in: 3600 });
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(`chronicle://user:secret@127.0.0.1:${port}?disableTls=true`, { discoveryPatterns: [] }));
        clients.push(client);
        await expect(client.getEventStores()).resolves.toEqual([]);
        expect(fetchToken).toHaveBeenCalledTimes(3);
    }, 10000);

    it('rejects persistent OAuth credential rejections after three connection attempts', async () => {
        const port = await listenAuthenticated();
        fetchToken.mockRejectedValue(new OAuthTokenHttpError(400, '{"error":"invalid_client"}'));
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(`chronicle://user:secret@127.0.0.1:${port}?disableTls=true`, { discoveryPatterns: [] }));
        clients.push(client);
        await expect(client.getEventStores()).rejects.toBeInstanceOf(RejectedChronicleCredentials);
        expect(fetchToken).toHaveBeenCalledTimes(3);
    }, 10000);

    it('keeps retrying proxy 403 responses without an OAuth error code', async () => {
        const checks = vi.fn();
        const port = await listenAuthenticated(checks);
        fetchToken.mockRejectedValue(new OAuthTokenHttpError(403, '<html>blocked</html>'));
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(`chronicle://user:secret@127.0.0.1:${port}?disableTls=true`, { discoveryPatterns: [] }));
        clients.push(client);
        const pending = client.getEventStores().then(() => undefined, error => error as Error);
        await new Promise(resolve => setTimeout(resolve, 6000));
        expect(checks.mock.calls.length).toBeGreaterThanOrEqual(4);
        client.dispose();
        expect((await pending).message).toMatch(/disposed/);
    }, 12000);

    it('rejects an API key after three unauthenticated kernel responses', async () => {
        const checks = vi.fn();
        const port = await listenAuthenticated(checks);
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString(`chronicle://127.0.0.1:${port}?disableTls=true&apiKey=wrong`, { discoveryPatterns: [] }));
        clients.push(client);
        await expect(client.getEventStores()).rejects.toBeInstanceOf(RejectedChronicleCredentials);
        expect(checks).toHaveBeenCalledTimes(3);
    }, 10000);

    it('reports the selected endpoint and underlying failure for development credentials', async () => {
        const port = await listen();
        fetchToken.mockRejectedValue(new Error('ECONNREFUSED'));
        const connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}?disableTls=true` });
        connections.push(connection);

        await expect(connection.connect()).resolves.toBeUndefined();
        expect(fetchToken.mock.calls[0][1]).toBe('chronicle-dev-client');
    });
});
