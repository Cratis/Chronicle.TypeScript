// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { ConnectionLifecycle, type ReconnectRequestedHandler } from '../../connection/ConnectionLifecycle.js';

chai.should();

const transport = vi.hoisted(() => ({
    resetChannel: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getVersionInfo: vi.fn(),
    allEventStores: vi.fn()
}));

vi.mock('../../connection/ChronicleConnection', () => ({
    ChronicleConnection: class {
        resetChannel = transport.resetChannel;
        connect = transport.connect;
        disconnect = transport.disconnect;
        server = { getVersionInfo: transport.getVersionInfo };
        eventStores = { allEventStores: transport.allEventStores };
    }
}));

vi.mock('../../connection/KernelKeepAlive', () => ({
    KernelKeepAlive: class {
        async start() {}
    }
}));

describe('when reconnecting because an observation stream lost its session', () => {
    let client: ChronicleClient;
    let lifecycle: ConnectionLifecycle;
    let connectionIdBefore: string;
    let disconnectedWith: string[];

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        const subscribe = ConnectionLifecycle.prototype.onReconnectRequested;
        vi.spyOn(ConnectionLifecycle.prototype, 'onReconnectRequested').mockImplementation(function (this: ConnectionLifecycle, handler: ReconnectRequestedHandler) {
            lifecycle = this;
            return subscribe.call(this, handler);
        });
        transport.resetChannel.mockResolvedValue(undefined);
        transport.connect.mockResolvedValue(undefined);
        transport.getVersionInfo.mockResolvedValue({});
        transport.allEventStores.mockResolvedValue({ IsAuthorized: true, Data: [] });
        client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        await client.getEventStores();
        connectionIdBefore = lifecycle.connectionId;
        disconnectedWith = [];
        lifecycle.onDisconnected(async () => { disconnectedWith.push(lifecycle.connectionId); });

        lifecycle.requestReconnect('reactor-session-lost',
            new ClientError('/Reactors/Observe', Status.UNKNOWN, 'ClientIsNotConnected: connection is not connected'));
        await vi.advanceTimersByTimeAsync(0);
    });

    afterEach(() => {
        client.dispose();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should drop the old session', () => disconnectedWith.should.deep.equal([connectionIdBefore]));
    it('should connect again', () => transport.connect.mock.calls.should.have.lengthOf(2));
    it('should reconnect with a new connection id', () => lifecycle.connectionId.should.not.equal(connectionIdBefore));
    it('should be connected again', () => lifecycle.isConnected.should.be.true);
});
