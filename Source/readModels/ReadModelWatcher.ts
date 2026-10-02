// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeset as ContractChangeset } from '@cratis/chronicle.contracts';
import type { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import type { IReadModelWatcher } from './IReadModelWatcher.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** @internal Owns one cancellable stream per connection generation. */
export class ReadModelWatcher<TReadModel> implements IReadModelWatcher<TReadModel>, AsyncIterableIterator<ReadModelChangeset<TReadModel>> {
    private static readonly _restartDelayMs = 1000;
    private static readonly _bufferLimit = 1024;

    private _subscribed!: Promise<void>;
    private _resolveSubscribed!: () => void;
    private _rejectSubscribed!: (error: unknown) => void;
    private _acknowledged = false;
    private _controller?: AbortController;
    private _stopped = false;
    private _failed = false;
    private _failure?: unknown;
    private readonly _buffered: ReadModelChangeset<TReadModel>[] = [];
    private _restartTimer?: ReturnType<typeof setTimeout>;
    private readonly _waiting: {
        resolve: (result: IteratorResult<ReadModelChangeset<TReadModel>>) => void;
        reject: (error: unknown) => void;
    }[] = [];
    private readonly _unsubscribe: (() => void)[] = [];

    constructor(
        private readonly _open: (signal: AbortSignal) => AsyncIterable<ContractChangeset>,
        private readonly _convert: (change: ContractChangeset) => Promise<ReadModelChangeset<TReadModel>>,
        signal: AbortSignal,
        private readonly _lifecycle?: ConnectionLifecycle
    ) {
        this.resetReadiness();
        const abort = () => this.finish(signal.reason, false);
        signal.addEventListener('abort', abort, { once: true });
        this._unsubscribe.push(() => signal.removeEventListener('abort', abort));
        if (_lifecycle) {
            this._unsubscribe.push(_lifecycle.onDisconnected(async () => this.disconnect()));
            this._unsubscribe.push(_lifecycle.onConnected(async () => this.start()));
            this._unsubscribe.push(_lifecycle.onFailed(async error => this.finish(error, true)));
        }
        if (signal.aborted) {
            abort();
        } else if (_lifecycle?.failure) {
            this.finish(_lifecycle.failure, true);
        } else if (!_lifecycle || _lifecycle.isConnected) {
            this.start();
        }
    }

    get subscribed(): Promise<void> {
        return this._subscribed;
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<ReadModelChangeset<TReadModel>> {
        return this;
    }

    next(): Promise<IteratorResult<ReadModelChangeset<TReadModel>>> {
        const value = this._buffered.shift();
        if (value) {
            return Promise.resolve({ done: false, value });
        }
        if (this._failed) return Promise.reject(this._failure);
        if (this._stopped) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve, reject) => this._waiting.push({ resolve, reject }));
    }

    async return(): Promise<IteratorResult<ReadModelChangeset<TReadModel>>> {
        this.dispose();
        return { done: true, value: undefined };
    }

    dispose(): void {
        this.finish(new DOMException('Read model watcher disposed.', 'AbortError'), false);
    }

    private resetReadiness(): void {
        this._acknowledged = false;
        this._subscribed = new Promise<void>((resolve, reject) => {
            this._resolveSubscribed = resolve;
            this._rejectSubscribed = reject;
        });
        // Legacy consumers only iterate. They still receive stream failures from next();
        // not observing the optional readiness promise must not cause an unhandled rejection.
        this._subscribed.catch(() => {});
    }

    private start(): void {
        if (this._stopped || this._controller) return;
        this.clearRestartTimer();
        const controller = new AbortController();
        this._controller = controller;
        void this.read(controller);
    }

    private disconnect(): void {
        if (this._stopped) return;
        this.clearRestartTimer();
        this.cancelStream();
        if (this._acknowledged) this.resetReadiness();
    }

    private restart(): void {
        this.disconnect();
        if (this._stopped || !this._lifecycle?.isConnected) return;
        // The watch and keep-alive share a transport, but can fail in either order.
        // Also recover a watch-only failure if no disconnected notification follows.
        this._restartTimer = setTimeout(() => {
            this._restartTimer = undefined;
            if (this._lifecycle?.isConnected) this.start();
        }, ReadModelWatcher._restartDelayMs);
        this._restartTimer.unref?.();
    }

    private clearRestartTimer(): void {
        clearTimeout(this._restartTimer);
        this._restartTimer = undefined;
    }

    private cancelStream(): void {
        const controller = this._controller;
        this._controller = undefined;
        controller?.abort();
        this._buffered.length = 0;
    }

    private async read(controller: AbortController): Promise<void> {
        try {
            for await (const change of this._open(controller.signal)) {
                if (this._controller !== controller) return;
                if (change.Subscribed) {
                    this._acknowledged = true;
                    this._resolveSubscribed();
                    continue;
                }
                let converted: ReadModelChangeset<TReadModel>;
                try {
                    converted = await this._convert(change);
                } catch (error) {
                    // Conversion includes compliance RPCs: even transport-coded errors here
                    // are terminal, not permission to skip an unreleased change.
                    if (this._controller === controller) this.finish(error, true);
                    return;
                }
                if (this._controller !== controller) return;
                const waiting = this._waiting.shift();
                if (waiting) {
                    waiting.resolve({ done: false, value: converted });
                } else {
                    // The kernel can send data before Subscribed. Never let consumer
                    // backpressure prevent reading the readiness marker or a stream failure.
                    if (this._buffered.length === ReadModelWatcher._bufferLimit) {
                        this.finish(new Error('Read model watcher buffer exceeded 1024 changes. Consume changes faster or refresh the read model and create a new watcher.'), true);
                        return;
                    }
                    this._buffered.push(converted);
                }
            }
            if (this._controller === controller) {
                if (this._lifecycle) this.restart();
                else this.finish(new Error('Read model watch ended before subscription acknowledgment.'), false);
            }
        } catch (error) {
            if (this._controller !== controller) return;
            const code = (error as { code?: number })?.code;
            if (this._lifecycle && code !== undefined && [1, 4, 13, 14].includes(code)) this.restart();
            else this.finish(error, true);
        }
    }

    private finish(reason: unknown, failed: boolean): void {
        if (this._stopped) return;
        this._stopped = true;
        this._failed = failed;
        this._failure = reason;
        this._rejectSubscribed(reason);
        this.clearRestartTimer();
        this.cancelStream();
        for (const unsubscribe of this._unsubscribe) unsubscribe();
        this._unsubscribe.length = 0;
        for (const waiting of this._waiting.splice(0)) {
            if (failed) waiting.reject(reason);
            else waiting.resolve({ done: true, value: undefined });
        }
    }
}
