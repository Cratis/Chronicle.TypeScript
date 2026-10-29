// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it } from 'vitest';
import { credentials as grpcCredentials, type ChannelCredentials } from '@grpc/grpc-js';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import type { ChronicleLogEntry } from '../../../logging/ChronicleLogEntry.js';

const connections: ChronicleConnection[] = [];

async function connectionWarnings(connectionString: string, resets = 0, credentials?: ChannelCredentials): Promise<ChronicleLogEntry[]> {
    const entries: ChronicleLogEntry[] = [];
    const connection = new ChronicleConnection({ connectionString, credentials, logger: { log: entry => { entries.push(entry); } } });
    connections.push(connection);
    await connection.resetChannel();
    for (let i = 0; i < resets; i++) await connection.resetChannel();
    return entries.filter(entry => entry.message.includes('TLS certificate validation'));
}

afterEach(() => {
    for (const connection of connections) connection.dispose();
    connections.length = 0;
});

describe('TLS validation warning', () => {
    it('warns once, naming the host, for a remote host with validation skipped', async () => {
        const warnings = await connectionWarnings('chronicle://chronicle.example.com:35000');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain('chronicle.example.com');
        expect(warnings[0].message).toContain('gRPC channel and OAuth token requests');
        expect(warnings[0].message).toContain('skipTlsValidation=false');
    });

    it.each(['localhost', '127.0.0.1', '127.1.2.3', '[::1]'])('does not warn for loopback host %s', async host => {
        expect(await connectionWarnings(`chronicle://${host}:35000`)).toHaveLength(0);
    });

    it('does not warn when validation is enabled', async () => {
        expect(await connectionWarnings('chronicle://chronicle.example.com:35000?skipTlsValidation=false')).toHaveLength(0);
    });

    it('does not warn when TLS is disabled', async () => {
        expect(await connectionWarnings('chronicle://chronicle.example.com:35000?disableTls=true')).toHaveLength(0);
    });

    it('does not warn again on reconnect', async () => {
        expect(await connectionWarnings('chronicle://chronicle.example.com:35000', 2)).toHaveLength(1);
    });

    it('warns about OAuth token requests only when custom credentials are used with token auth', async () => {
        const warnings = await connectionWarnings('chronicle://client:secret@chronicle.example.com:35000', 0, grpcCredentials.createInsecure());
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain('OAuth token requests to chronicle.example.com');
        expect(warnings[0].message).not.toContain('gRPC channel');
    });

    it('does not warn when custom credentials are used with an API key', async () => {
        expect(await connectionWarnings('chronicle://chronicle.example.com:35000?apiKey=key', 0, grpcCredentials.createInsecure())).toHaveLength(0);
    });
});
