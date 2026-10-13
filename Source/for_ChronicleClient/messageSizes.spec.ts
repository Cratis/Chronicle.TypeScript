// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';

const connections = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock('../connection/ChronicleConnection.js', () => ({
    ChronicleConnection: class {
        constructor(options: Record<string, unknown>) { connections.push(options); }
        disconnect() {}
    }
}));
vi.mock('../connection/KernelKeepAlive.js', () => ({ KernelKeepAlive: class { async start() {} } }));

describe('when creating a client', () => {
    it('should give the connection the default message sizes, so a read model past 4 MB is not refused', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        client.dispose();
        expect(connections.at(-1)?.maxReceiveMessageSize).toBe(100 * 1024 * 1024);
        expect(connections.at(-1)?.maxSendMessageSize).toBe(100 * 1024 * 1024);
    });

    it('should give the connection the configured message sizes', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [], maxReceiveMessageSize: 1, maxSendMessageSize: 2 }));
        client.dispose();
        expect(connections.at(-1)?.maxReceiveMessageSize).toBe(1);
        expect(connections.at(-1)?.maxSendMessageSize).toBe(2);
    });

    it('should leave the gRPC default in place when asked for null', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [], maxReceiveMessageSize: null }));
        client.dispose();
        expect(connections.at(-1)?.maxReceiveMessageSize).toBeUndefined();
    });
});
