// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ConnectRequest } from '@cratis/chronicle.contracts';
import { KernelKeepAlive, type IKeepAliveConnections } from './KernelKeepAlive';

const request = { ConnectionId: 'connection-1' } as unknown as ConnectRequest;

const timeouts = { idleTimeoutMs: 50, answerTimeoutMs: 50 };

/**
 * A `Connect` stream the spec drives by hand — push keep-alives, end it, or simply
 * leave it silent to model the kernel evicting a client without closing the stream.
 */
function createStream() {
    const pending: Array<(result: IteratorResult<unknown>) => void> = [];
    const queued: Array<IteratorResult<unknown>> = [];

    const push = (result: IteratorResult<unknown>) => {
        const waiter = pending.shift();
        if (waiter) {
            waiter(result);
        } else {
            queued.push(result);
        }
    };

    return {
        sendKeepAlive: () => push({ done: false, value: { ConnectionId: 'connection-1' } }),
        end: () => push({ done: true, value: undefined }),
        asIterable: (): AsyncIterable<unknown> => ({
            [Symbol.asyncIterator]: () => ({
                next: () => {
                    const ready = queued.shift();
                    if (ready) {
                        return Promise.resolve(ready);
                    }

                    return new Promise<IteratorResult<unknown>>(resolve => pending.push(resolve));
                }
            })
        })
    };
}

function createConnections(stream: AsyncIterable<unknown>, answer = vi.fn().mockResolvedValue({})) {
    return {
        connections: { connect: () => stream, connectionKeepAlive: answer } as unknown as IKeepAliveConnections,
        answer
    };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('KernelKeepAlive', () => {
    describe('when the kernel sends keep-alives', () => {
        it('should answer every one of them', async () => {
            const stream = createStream();
            const { connections, answer } = createConnections(stream.asIterable());
            const controller = new AbortController();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, vi.fn(), timeouts).start(request, controller.signal);

            stream.sendKeepAlive();
            await flush();
            stream.sendKeepAlive();
            await flush();

            controller.abort();

            // Each answer is what bumps LastSeen on the kernel; missing them gets the
            // client evicted while the stream stays open.
            expect(answer).toHaveBeenCalledTimes(3);
        });

        it('should not report the connection as lost', async () => {
            const stream = createStream();
            const { connections } = createConnections(stream.asIterable());
            const onConnectionLost = vi.fn();
            const controller = new AbortController();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, onConnectionLost, timeouts).start(request, controller.signal);

            stream.sendKeepAlive();
            await flush();
            controller.abort();

            expect(onConnectionLost).not.toHaveBeenCalled();
        });
    });

    describe('when the stream goes silent', () => {
        it('should report the connection as lost', async () => {
            const stream = createStream();
            const { connections } = createConnections(stream.asIterable());
            const onConnectionLost = vi.fn();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, onConnectionLost, timeouts).start(request, new AbortController().signal);

            // The kernel does not close the stream when its watchdog evicts a client,
            // so silence — not an error — is what a half-disconnect looks like.
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(onConnectionLost).toHaveBeenCalledOnce();
        });
    });

    describe('when the stream ends', () => {
        it('should report the connection as lost', async () => {
            const stream = createStream();
            const { connections } = createConnections(stream.asIterable());
            const onConnectionLost = vi.fn();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, onConnectionLost, timeouts).start(request, new AbortController().signal);

            stream.end();
            await flush();

            expect(onConnectionLost).toHaveBeenCalledWith('keep-alive-stream-ended', expect.anything());
        });
    });

    describe('when answering a keep-alive fails', () => {
        it('should report the connection as lost', async () => {
            const stream = createStream();
            const answer = vi.fn().mockResolvedValueOnce({}).mockRejectedValue(new Error('unavailable'));
            const { connections } = createConnections(stream.asIterable(), answer);
            const onConnectionLost = vi.fn();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, onConnectionLost, timeouts).start(request, new AbortController().signal);

            stream.sendKeepAlive();
            await flush();

            expect(onConnectionLost).toHaveBeenCalledWith('keep-alive-failed', expect.anything());
        });
    });

    describe('when the kernel never sends a first keep-alive', () => {
        it('should fail to start rather than hang', async () => {
            const stream = createStream();
            const { connections } = createConnections(stream.asIterable());

            // Every caller waiting on the connection queues behind this, so it must
            // never be allowed to wait forever.
            await expect(
                new KernelKeepAlive(connections, vi.fn(), timeouts).start(request, new AbortController().signal)
            ).rejects.toThrow(/Timed out waiting for the first keep-alive/);
        });
    });

    describe('when the keep-alive has been aborted', () => {
        it('should not report the connection as lost', async () => {
            const stream = createStream();
            const { connections } = createConnections(stream.asIterable());
            const onConnectionLost = vi.fn();
            const controller = new AbortController();

            stream.sendKeepAlive();
            await new KernelKeepAlive(connections, onConnectionLost, timeouts).start(request, controller.signal);

            controller.abort();
            await new Promise(resolve => setTimeout(resolve, 100));

            // A deliberate shutdown is not a lost connection and must not trigger a reconnect.
            expect(onConnectionLost).not.toHaveBeenCalled();
        });
    });
});
