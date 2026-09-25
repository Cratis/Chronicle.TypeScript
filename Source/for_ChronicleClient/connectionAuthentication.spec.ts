// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChronicleClient } from '../ChronicleClient.js';
import { ChronicleOptions } from '../ChronicleOptions.js';
import { RejectedChronicleCredentials } from '../connection/RejectedChronicleCredentials.js';

const transport = vi.hoisted(() => ({ connect: vi.fn(), resetChannel: vi.fn(), disconnect: vi.fn(), getVersionInfo: vi.fn(), allEventStores: vi.fn() }));
vi.mock('../connection/ChronicleConnection.js', () => ({
    ChronicleConnection: class {
        connect = transport.connect;
        resetChannel = transport.resetChannel;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { allEventStores: transport.allEventStores };
    }
}));
vi.mock('../connection/KernelKeepAlive.js', () => ({ KernelKeepAlive: class { async start() {} } }));

let client: ChronicleClient;
beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    transport.connect.mockResolvedValue(undefined);
    transport.resetChannel.mockResolvedValue(undefined);
    transport.getVersionInfo.mockResolvedValue({});
    transport.allEventStores.mockResolvedValue({ IsAuthorized: true, Data: [] });
    client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
});
afterEach(() => { client.dispose(); vi.useRealTimers(); });

describe('client authentication recovery', () => {
    it('connects when an anonymous kernel accepts calls despite an unavailable token endpoint', async () => {
        await expect(client.getEventStores()).resolves.toEqual([]);
        expect(transport.connect).toHaveBeenCalledTimes(1);
    });

    it('preserves a typed terminal error when an established call enters withReconnect', async () => {
        await client.getEventStores();
        transport.allEventStores.mockRejectedValue(new RejectedChronicleCredentials('rejected'));
        await expect(client.getEventStores()).rejects.toBeInstanceOf(RejectedChronicleCredentials);
        await expect(client.getEventStores()).rejects.toThrow('rejected');
        expect(transport.connect).toHaveBeenCalledTimes(1);
    });

    it('makes a terminal error on the retried call permanent', async () => {
        await client.getEventStores();
        const rejection = new RejectedChronicleCredentials('rejected after reconnect');
        transport.allEventStores.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 14 }))
            .mockRejectedValueOnce(rejection);
        await expect(client.getEventStores()).rejects.toBe(rejection);
        const calls = transport.allEventStores.mock.calls.length;
        await expect(client.getEventStores()).rejects.toBe(rejection);
        expect(transport.allEventStores).toHaveBeenCalledTimes(calls);
    });

    it('continues retrying a network outage until disposed', async () => {
        transport.connect.mockRejectedValue(new Error('UNAVAILABLE: connection refused'));
        const pending = client.getEventStores().then(() => undefined, error => error as Error);
        await vi.advanceTimersByTimeAsync(4500);
        expect(transport.connect.mock.calls.length).toBeGreaterThan(1);
        client.dispose();
        await vi.runAllTimersAsync();
        expect((await pending).message).toMatch(/disposed/);
    });
});
