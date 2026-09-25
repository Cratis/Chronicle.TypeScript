// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';
import { KernelKeepAlive } from './KernelKeepAlive.js';
import { clientVersion } from './clientVersion.js';

const require = createRequire(import.meta.url);

describe('Chronicle client version', () => {
    it('uses the installed package version for kernel keep-alive', async () => {
        const expected = (require('@cratis/chronicle/package.json') as { version: string }).version;
        const start = vi.spyOn(KernelKeepAlive.prototype, 'start').mockResolvedValue(undefined);
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        try {
            await (client as unknown as { startKernelKeepAlive(): Promise<void> }).startKernelKeepAlive();
            expect(clientVersion).toBe(expected);
            expect(start.mock.calls[0][0].ClientVersion).toBe(expected);
        } finally {
            client.dispose();
            start.mockRestore();
        }
    });
});
