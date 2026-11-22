// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A push-based queue for one bidirectional observation attempt. */
export class AsyncQueue<T> implements AsyncIterable<T> {
    private readonly _queue: T[] = [];
    private _resolve: ((result: IteratorResult<T, undefined>) => void) | undefined;
    private _done = false;

    send(value: T): void {
        if (this._done) return;
        if (this._resolve) {
            const resolve = this._resolve;
            this._resolve = undefined;
            resolve({ value, done: false });
        } else {
            this._queue.push(value);
        }
    }

    complete(): void {
        this._done = true;
        this._queue.length = 0;
        this._resolve?.({ value: undefined, done: true });
        this._resolve = undefined;
    }

    [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
        return {
            next: () => {
                if (this._queue.length > 0) return Promise.resolve({ value: this._queue.shift()!, done: false });
                if (this._done) return Promise.resolve({ value: undefined, done: true });
                return new Promise(resolve => { this._resolve = resolve; });
            },
            return: () => {
                this.complete();
                return Promise.resolve({ value: undefined, done: true });
            }
        };
    }
}
