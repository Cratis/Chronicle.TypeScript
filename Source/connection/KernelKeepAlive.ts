// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import type { ConnectRequest } from '@cratis/chronicle.contracts';

/**
 * Overrides for how long {@link KernelKeepAlive} waits before giving up on the kernel.
 */
export interface KeepAliveTimeouts {
    /** How long to wait for a keep-alive before treating the connection as dead. */
    idleTimeoutMs?: number;
    /** How long a single answer may take before the connection is considered dead. */
    answerTimeoutMs?: number;
}

/**
 * The subset of the connection service {@link KernelKeepAlive} needs, so it can be
 * exercised without a live kernel.
 */
export interface IKeepAliveConnections {
    connect(request: ConnectRequest, options?: { signal?: AbortSignal }): AsyncIterable<unknown>;
    connectionKeepAlive(request: object, options?: { signal?: AbortSignal }): Promise<unknown>;
}

/**
 * Drives the client half of Chronicle's keep-alive ping-pong.
 *
 * The kernel pushes a `ConnectionKeepAlive` down the `Connect` server stream once
 * per second, and for each one the client must call the separate unary
 * `ConnectionKeepAlive` RPC back — that is what bumps `LastSeen` on the kernel and
 * keeps the client registered. A client that stops answering is evicted, its
 * observers are unsubscribed, and reactors and reducers go silent while appends
 * keep working.
 *
 * Eviction does not close the `Connect` stream, so a dead session usually presents
 * as a stream that simply goes quiet rather than one that errors. Both a gap
 * between keep-alives and an ended stream therefore mean the same thing: the
 * connection is gone and the client must reconnect.
 */
export class KernelKeepAlive {
    /**
     * How long to wait for a keep-alive before treating the connection as dead.
     * The kernel emits one per second and evicts clients whose `LastSeen` falls
     * more than five seconds behind, which is the threshold the C# client uses too.
     */
    static readonly defaultIdleTimeoutMs = 5000;

    /** How long a single answer may take before the connection is considered dead. */
    static readonly defaultAnswerTimeoutMs = 5000;

    private readonly _logger = diag.createComponentLogger({
        namespace: '@cratis/chronicle/KernelKeepAlive'
    });

    private readonly _idleTimeoutMs: number;
    private readonly _answerTimeoutMs: number;

    /**
     * Creates a new {@link KernelKeepAlive}.
     * @param connections - The connection service to ping-pong with.
     * @param onConnectionLost - Called once when the connection is found to be dead.
     * @param timeouts - Overrides for the default timeouts.
     */
    constructor(
        private readonly connections: IKeepAliveConnections,
        private readonly onConnectionLost: (reason: string, error: unknown) => void,
        timeouts: KeepAliveTimeouts = {}
    ) {
        this._idleTimeoutMs = timeouts.idleTimeoutMs ?? KernelKeepAlive.defaultIdleTimeoutMs;
        this._answerTimeoutMs = timeouts.answerTimeoutMs ?? KernelKeepAlive.defaultAnswerTimeoutMs;
    }

    /**
     * Opens the `Connect` stream and answers the first keep-alive, establishing the
     * client's registration with the kernel. Resolves once the kernel has been heard
     * from; the ongoing ping-pong then continues in the background until the
     * connection is lost or `signal` is aborted.
     * @param request - The connect request identifying this client.
     * @param signal - Aborted to stop the keep-alive entirely.
     */
    async start(request: ConnectRequest, signal: AbortSignal): Promise<void> {
        const stream = this.connections.connect(request, { signal });
        const iterator = stream[Symbol.asyncIterator]();

        // A kernel that accepts the stream but never sends anything must not hang
        // the connect indefinitely — every caller awaiting the connection would
        // block forever behind it.
        const first = await this.withTimeout(
            iterator.next(),
            this._idleTimeoutMs,
            'Timed out waiting for the first keep-alive from the kernel'
        );

        if (first.done) {
            throw new Error('Connection service stream ended before sending first keep-alive');
        }

        await this.answer(first.value, signal);
        void this.run(iterator, signal);
    }

    private async run(iterator: AsyncIterator<unknown, unknown>, signal: AbortSignal): Promise<void> {
        try {
            while (!signal.aborted) {
                const result = await this.withTimeout(
                    iterator.next(),
                    this._idleTimeoutMs,
                    'No keep-alive received from the kernel within the idle timeout'
                );

                if (result.done) {
                    this.connectionLost('keep-alive-stream-ended', new Error('Keep-alive stream ended'));
                    return;
                }

                await this.answer(result.value, signal);
            }
        } catch (error) {
            if (!signal.aborted) {
                this.connectionLost('keep-alive-failed', error);
            }
        }
    }

    private async answer(keepAlive: unknown, signal: AbortSignal): Promise<void> {
        // An answer that never returns would stop the loop draining the stream, which
        // gets the client evicted just as surely as never answering at all.
        await this.withTimeout(
            this.connections.connectionKeepAlive(keepAlive as object, { signal }),
            this._answerTimeoutMs,
            'Timed out answering a kernel keep-alive'
        );
    }

    private connectionLost(reason: string, error: unknown): void {
        this._logger.warn('Kernel keep-alive lost the connection', {
            reason,
            error: error instanceof Error ? error.message : String(error)
        });
        this.onConnectionLost(reason, error);
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
        let handle: ReturnType<typeof setTimeout> | undefined;

        try {
            return await Promise.race([
                promise,
                new Promise<never>((_, reject) => {
                    handle = setTimeout(() => reject(new Error(message)), timeoutMs);
                    handle.unref?.();
                })
            ]);
        } finally {
            if (handle) {
                clearTimeout(handle);
            }
        }
    }
}
