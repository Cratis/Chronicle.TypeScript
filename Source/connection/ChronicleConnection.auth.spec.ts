// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, ServerError, type ServiceImplementation } from 'nice-grpc';
import { ConnectionServiceDefinition } from '@cratis/chronicle.contracts';
import { status } from '@grpc/grpc-js';
import { ChronicleConnection } from './ChronicleConnection.js';

const fetchToken = vi.hoisted(() => vi.fn());
vi.mock('./fetchOAuthAccessToken.js', () => ({ fetchOAuthAccessToken: fetchToken }));

const servers: Array<ReturnType<typeof createServer>> = [];
const connections: ChronicleConnection[] = [];

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

afterEach(async () => {
    for (const connection of connections) connection.dispose();
    for (const server of servers) await server.shutdown();
    connections.length = 0;
    servers.length = 0;
    fetchToken.mockReset();
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

    it('reports the selected endpoint and underlying failure for development credentials', async () => {
        const port = await listen();
        fetchToken.mockRejectedValue(new Error('ECONNREFUSED'));
        const connection = new ChronicleConnection({ connectionString: `chronicle://127.0.0.1:${port}?disableTls=true` });
        connections.push(connection);

        await expect(connection.connect()).resolves.toBeUndefined();
        expect(fetchToken.mock.calls[0][1]).toBe('chronicle-dev-client');
    });
});
