// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it } from 'vitest';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import type { ChronicleLogEntry } from '../../../logging/ChronicleLogEntry.js';

const connections: ChronicleConnection[] = [];

async function connectionWarnings(connectionString: string, resets = 0): Promise<ChronicleLogEntry[]> {
    const entries: ChronicleLogEntry[] = [];
    const connection = new ChronicleConnection({ connectionString, logger: { log: entry => { entries.push(entry); } } });
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
});
