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

describe('when creating a client with a connect timeout', () => {
    it('should give the connection the default connect timeout', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        client.dispose();
        expect(connections.at(-1)?.connectTimeout).toBe(10_000);
    });

    it('should give the connection the configured connect timeout', () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [], connectTimeout: 1_234 }));
        client.dispose();
        expect(connections.at(-1)?.connectTimeout).toBe(1_234);
    });
});
