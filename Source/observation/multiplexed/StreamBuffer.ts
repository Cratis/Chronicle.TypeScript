// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The ordered, unbounded buffer one stream delivers into and its observer reads from at its own pace, so a slow
 * observer never holds up reading what the kernel sends to the others.
 */
export class StreamBuffer<T> {
    private readonly _items: T[] = [];
    private _waiting: { resolve: (result: IteratorResult<T, undefined>) => void; reject: (error: unknown) => void } | undefined;
    private _done = false;
    private _failure: { error: unknown } | undefined;

    /** Adds an item after the ones before it. Ignored once the buffer is completed or failed. */
    push(item: T): void {
        if (this._done) return;
        const waiting = this._waiting;
        if (waiting) {
            this._waiting = undefined;
            waiting.resolve({ value: item, done: false });
        } else {
            this._items.push(item);
        }
    }

    /** Ends the buffer; the reader gets what is buffered, then the end. */
    complete(): void {
        if (this._done) return;
        this._done = true;
        const waiting = this._waiting;
        this._waiting = undefined;
        waiting?.resolve({ value: undefined, done: true });
    }

    /** Fails the buffer; the reader gets what is buffered, then the error. */
    fail(error: unknown): void {
        if (this._done) return;
        this._failure = { error };
        this._done = true;
        const waiting = this._waiting;
        this._waiting = undefined;
        waiting?.reject(error);
    }

    /** Reads the next item, waiting for it when there is none yet. */
    next(): Promise<IteratorResult<T, undefined>> {
        if (this._items.length > 0) return Promise.resolve({ value: this._items.shift()!, done: false });
        if (this._failure) {
            const { error } = this._failure;
            this._failure = undefined;
            return Promise.reject(error);
        }
        if (this._done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => { this._waiting = { resolve, reject }; });
    }

    /**
     * Reads a buffer as an iterator of what `select` picks out of each item, skipping the items it picks nothing from.
     * @param buffer - The buffer to read.
     * @param select - Picks what the reader wants from an item.
     * @param onReturn - Called when the reader stops reading before the end.
     * @returns The iterator.
     */
    static iterate<T, TOut>(buffer: StreamBuffer<T>, select: (item: T) => TOut | undefined, onReturn: () => void): AsyncIterator<TOut> {
        return {
            async next(): Promise<IteratorResult<TOut>> {
                for (;;) {
                    const result = await buffer.next();
                    if (result.done) return { value: undefined, done: true };
                    const value = select(result.value);
                    if (value !== undefined) return { value, done: false };
                }
            },
            return(): Promise<IteratorResult<TOut>> {
                onReturn();
                buffer.complete();
                return Promise.resolve({ value: undefined, done: true });
            }
        };
    }
}
