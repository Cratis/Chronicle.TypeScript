// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { IncompatibleChronicleServer } from '../../connection/IncompatibleChronicleServer.js';

chai.should();

const transport = vi.hoisted(() => ({
    resetChannel: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getVersionInfo: vi.fn(),
    allEventStores: vi.fn(),
    ensureEventStore: vi.fn(),
    append: vi.fn(),
    lost: undefined as ((reason: string, error: unknown) => void) | undefined
}));

vi.mock('../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        resetChannel = transport.resetChannel;
        connect = transport.connect;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { allEventStores: transport.allEventStores, ensureEventStore: transport.ensureEventStore };
        eventSequences = { append: transport.append };
    }
}));

vi.mock('../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class {
        constructor(_connections: unknown, onLost: (reason: string, error: unknown) => void) {
            transport.lost = onLost;
        }
        async start() {}
    }
}));

describe.each(['watchdog', 'keep-alive', 'awaited operation'])('when %s recovery reaches an incompatible server', boundary => {
    let client: ChronicleClient;
    let rejection: IncompatibleChronicleServer;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        transport.resetChannel.mockResolvedValue(undefined);
        transport.connect.mockResolvedValue(undefined);
        transport.getVersionInfo.mockResolvedValue({});
        transport.allEventStores.mockResolvedValue({ IsAuthorized: true, Data: [] });
        client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        await client.getEventStores();
        rejection = new IncompatibleChronicleServer('The replacement server is incompatible.');
    });

    afterEach(() => {
        client.dispose();
        vi.useRealTimers();
    });

    it('should contain background rejection and fail current and later callers without retrying writes', async () => {
        let rejectVerification!: (reason: unknown) => void;
        const verification = new Promise<void>((_resolve, reject) => { rejectVerification = reject; });
        transport.connect.mockReturnValue(verification);
        let awaited: Promise<PromiseSettledResult<unknown>[]> | undefined;
        if (boundary === 'watchdog') {
            transport.getVersionInfo.mockRejectedValue(new Error('connection unavailable'));
            await vi.advanceTimersByTimeAsync(5000);
        } else if (boundary === 'keep-alive') {
            transport.lost!('keep-alive-ended', new Error('connection unavailable'));
            await vi.advanceTimersByTimeAsync(0);
        } else {
            transport.allEventStores.mockRejectedValueOnce(new Error('connection unavailable'));
            awaited = Promise.allSettled([client.getEventStores()]);
            await vi.advanceTimersByTimeAsync(0);
        }
        transport.connect.mock.calls.should.have.lengthOf(2);
        const waiting = Promise.allSettled([client.getEventStores()]);
        rejectVerification(rejection);
        await vi.advanceTimersByTimeAsync(0);
        const results = [...await waiting, ...(awaited ? await awaited : []), ...await Promise.allSettled([client.getEventStores()])];
        results.forEach(result => {
            result.status.should.equal('rejected');
            if (result.status === 'rejected') result.reason.should.equal(rejection);
        });
        await vi.advanceTimersByTimeAsync(15000);
        transport.connect.mock.calls.should.have.lengthOf(2);
        transport.allEventStores.mock.calls.should.have.lengthOf(boundary === 'awaited operation' ? 2 : 1);
        transport.ensureEventStore.mock.calls.should.have.lengthOf(0);
        transport.append.mock.calls.should.have.lengthOf(0);
        transport.disconnect.mock.calls.length.should.be.greaterThan(0);
    });
});
