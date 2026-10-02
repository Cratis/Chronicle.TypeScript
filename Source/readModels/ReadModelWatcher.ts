// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeset as ContractChangeset } from '@cratis/chronicle.contracts';
import type { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import type { IReadModelWatcher } from './IReadModelWatcher.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** @internal Owns one cancellable stream per connection generation. */
export class ReadModelWatcher<TReadModel> implements IReadModelWatcher<TReadModel>, AsyncIterableIterator<ReadModelChangeset<TReadModel>> {
    private _subscribed!: Promise<void>;
    private _resolveSubscribed!: () => void;
    private _rejectSubscribed!: (error: unknown) => void;
    private _acknowledged = false;
    private _controller?: AbortController;
    private _stopped = false;
    private _failed = false;
    private _failure?: unknown;
    private _buffered?: ReadModelChangeset<TReadModel>;
    private _resume?: () => void;
    private readonly _waiting: {
        resolve: (result: IteratorResult<ReadModelChangeset<TReadModel>>) => void;
        reject: (error: unknown) => void;
    }[] = [];
    private readonly _unsubscribe: (() => void)[] = [];

    constructor(
        private readonly _open: (signal: AbortSignal) => AsyncIterable<ContractChangeset>,
        private readonly _convert: (change: ContractChangeset) => Promise<ReadModelChangeset<TReadModel>>,
        signal: AbortSignal,
        lifecycle?: ConnectionLifecycle
    ) {
        this.resetReadiness();
        const abort = () => this.finish(signal.reason, false);
        signal.addEventListener('abort', abort, { once: true });
        this._unsubscribe.push(() => signal.removeEventListener('abort', abort));
        if (lifecycle) {
            this._unsubscribe.push(lifecycle.onDisconnected(async () => this.disconnect()));
            this._unsubscribe.push(lifecycle.onConnected(async () => this.start()));
        }
        if (signal.aborted) {
            abort();
        } else if (!lifecycle || lifecycle.isConnected) {
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
        if (this._buffered) {
            const value = this._buffered;
            this._buffered = undefined;
            this._resume?.();
            this._resume = undefined;
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
        const controller = new AbortController();
        this._controller = controller;
        void this.read(controller);
    }

    private disconnect(): void {
        if (this._stopped) return;
        this.cancelStream();
        if (this._acknowledged) this.resetReadiness();
    }

    private cancelStream(): void {
        const controller = this._controller;
        this._controller = undefined;
        controller?.abort();
        this._buffered = undefined;
        this._resume?.();
        this._resume = undefined;
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
                const converted = await this._convert(change);
                if (this._controller !== controller) return;
                const waiting = this._waiting.shift();
                if (waiting) {
                    waiting.resolve({ done: false, value: converted });
                } else {
                    // One-item lookahead keeps readiness eager without an unbounded client queue.
                    this._buffered = converted;
                    await new Promise<void>(resolve => { this._resume = resolve; });
                }
            }
            if (this._controller === controller) {
                this.finish(new Error('Read model watch ended before subscription acknowledgment.'), false);
            }
        } catch (error) {
            if (this._controller === controller) this.finish(error, true);
        }
    }

    private finish(reason: unknown, failed: boolean): void {
        if (this._stopped) return;
        this._stopped = true;
        this._failed = failed;
        this._failure = reason;
        this._rejectSubscribed(reason);
        this.cancelStream();
        for (const unsubscribe of this._unsubscribe) unsubscribe();
        this._unsubscribe.length = 0;
        for (const waiting of this._waiting.splice(0)) {
            if (failed) waiting.reject(reason);
            else waiting.resolve({ done: true, value: undefined });
        }
    }
}
