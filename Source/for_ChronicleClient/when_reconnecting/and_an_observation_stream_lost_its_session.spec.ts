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

const sessionLost = () => new ClientError('/Reactors/Observe', Status.UNKNOWN, 'ClientIsNotConnected: connection is not connected');
const ignore = () => undefined;

/**
 * A connected client on fake timers and a jitter of zero, so each session-reconnect wait is exactly half its ceiling:
 * 500 ms after the first session lost soon after connecting, 1 000 ms after the second, and so on.
 */
class a_connected_client {
    client!: ChronicleClient;
    lifecycle!: ConnectionLifecycle;
    readonly connectedAt: number[] = [];

    async establish(): Promise<void> {
        vi.useFakeTimers();
        vi.clearAllMocks();
        const subscribe = ConnectionLifecycle.prototype.onReconnectRequested;
        const self = this;
        vi.spyOn(ConnectionLifecycle.prototype, 'onReconnectRequested').mockImplementation(function (this: ConnectionLifecycle, handler: ReconnectRequestedHandler) {
            self.lifecycle = this;
            return subscribe.call(this, handler);
        });
        transport.resetChannel.mockResolvedValue(undefined);
        transport.connect.mockImplementation(async () => { this.connectedAt.push(Date.now()); });
        transport.getVersionInfo.mockResolvedValue({});
        transport.allEventStores.mockResolvedValue({ IsAuthorized: true, Data: [] });
        this.client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }),
            { now: () => Date.now(), nextJitter: () => 0 });
        await this.client.getEventStores();
    }

    /** Reports, from an observation stream of the given session, that the kernel lost it. */
    loseSession(connectionId: string = this.lifecycle.connectionId): void {
        this.lifecycle.requestReconnect(connectionId, 'reactor-session-lost', sessionLost(), ignore);
    }

    /** Gets the wait before each connect after the first. */
    get waits(): number[] {
        return this.connectedAt.slice(1).map((at, index) => at - this.connectedAt[index]);
    }

    dispose(): void {
        this.client.dispose();
        vi.restoreAllMocks();
        vi.useRealTimers();
    }
}

describe('when reconnecting because an observation stream lost its session', () => {
    let context: a_connected_client;
    let connectionIdBefore: string;
    let disconnectedWith: string[];

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        connectionIdBefore = context.lifecycle.connectionId;
        disconnectedWith = [];
        context.lifecycle.onDisconnected(async () => { disconnectedWith.push(context.lifecycle.connectionId); });

        context.loseSession();
        await vi.advanceTimersByTimeAsync(1_000);
    });

    afterEach(() => context.dispose());

    it('should drop the old session', () => disconnectedWith.should.deep.equal([connectionIdBefore]));
    it('should connect again', () => transport.connect.mock.calls.should.have.lengthOf(2));
    it('should reconnect with a new connection id', () => context.lifecycle.connectionId.should.not.equal(connectionIdBefore));
    it('should be connected again', () => context.lifecycle.isConnected.should.be.true);
});

describe('when reconnecting because sessions keep being lost right after connecting', () => {
    let context: a_connected_client;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        context.loseSession();
        await vi.advanceTimersByTimeAsync(5_000);
        context.loseSession();
        await vi.advanceTimersByTimeAsync(5_000);
    });

    afterEach(() => context.dispose());

    it('should wait longer before each reconnect', () => context.waits.should.deep.equal([500, 5_000 + 1_000 - 500]));
});

describe('when reconnecting because a session that stayed up was lost', () => {
    let context: a_connected_client;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        context.loseSession();
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(31_000);
        context.loseSession();
        await vi.advanceTimersByTimeAsync(0);
    });

    afterEach(() => context.dispose());

    it('should reconnect without waiting', () => context.waits.should.deep.equal([500, 31_000]));
});

describe('when an observation stream reports a session that was already replaced', () => {
    let context: a_connected_client;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        context.loseSession('a-connection-the-client-no-longer-uses');
        await vi.advanceTimersByTimeAsync(5_000);
    });

    afterEach(() => context.dispose());

    it('should not reconnect', () => transport.connect.mock.calls.should.have.lengthOf(1));
});

describe('when many observation streams report the same lost session', () => {
    let context: a_connected_client;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        const connectionId = context.lifecycle.connectionId;
        for (let report = 0; report < 5; report++) context.loseSession(connectionId);
        await vi.advanceTimersByTimeAsync(5_000);
    });

    afterEach(() => context.dispose());

    it('should reconnect once', () => transport.connect.mock.calls.should.have.lengthOf(2));
});

describe('when the new session is lost while the reconnect is still registering observers', () => {
    let context: a_connected_client;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        let reported = false;
        context.lifecycle.onConnected(async () => {
            if (reported) return;
            reported = true;
            context.loseSession();
        });
        context.loseSession();
        await vi.advanceTimersByTimeAsync(5_000);
    });

    afterEach(() => context.dispose());

    it('should reconnect again for the new session', () => transport.connect.mock.calls.should.have.lengthOf(3));
});

describe('when disposing the client while it waits to reconnect a lost session', () => {
    let context: a_connected_client;
    let timersAfterDispose: number;

    beforeEach(async () => {
        context = new a_connected_client();
        await context.establish();
        context.loseSession();
        await vi.advanceTimersByTimeAsync(0);
        context.client.dispose();
        timersAfterDispose = vi.getTimerCount();
        await vi.advanceTimersByTimeAsync(5_000);
    });

    afterEach(() => context.dispose());

    it('should not connect again', () => transport.connect.mock.calls.should.have.lengthOf(1));
    it('should leave no timer behind', () => timersAfterDispose.should.equal(0));
});
