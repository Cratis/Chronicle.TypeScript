// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * A single subscriber's push queue, implementing {@link AsyncIterator} so values sent via
 * {@link AppendOperationsQueue.send} are yielded in order to whoever is iterating it.
 */
class AppendOperationsQueue<T> {
    private readonly _queue: T[] = [];
    private _resolve: ((result: IteratorResult<T, undefined>) => void) | undefined;
    private _done = false;

    /** Pushes a value to this subscriber. No-op once the queue has been completed. */
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

    /** Signals that no more values will be pushed, ending the subscriber's iteration. */
    complete(): void {
        this._done = true;
        if (this._resolve) {
            this._resolve({ value: undefined, done: true });
            this._resolve = undefined;
        }
    }

    next(): Promise<IteratorResult<T, undefined>> {
        if (this._queue.length > 0) {
            return Promise.resolve({ value: this._queue.shift()!, done: false });
        }
        if (this._done) {
            return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise(resolve => {
            this._resolve = resolve;
        });
    }
}

/**
 * A hot, multicast {@link AsyncIterable}: every concurrent iterator receives every value
 * {@link publish}ed from the moment it starts iterating, mirroring the semantics of C#'s
 * `IObservable<T>` (via `Observable.FromEvent`) that {@link IEventSequence.appendOperations} is
 * based on. Values published while nobody is iterating are simply dropped — there is no replay
 * buffer, matching a hot observable with no subscribers.
 */
export class AppendOperationsBroadcaster<T> implements AsyncIterable<T> {
    private readonly _subscribers = new Set<AppendOperationsQueue<T>>();

    /** Whether at least one consumer is currently iterating this broadcaster. */
    get hasSubscribers(): boolean {
        return this._subscribers.size > 0;
    }

    /** Publishes a value to every current subscriber. */
    publish(value: T): void {
        for (const subscriber of this._subscribers) {
            subscriber.send(value);
        }
    }

    [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
        const queue = new AppendOperationsQueue<T>();
        this._subscribers.add(queue);
        const subscribers = this._subscribers;

        return {
            next: () => queue.next(),
            return(value?: undefined): Promise<IteratorResult<T, undefined>> {
                subscribers.delete(queue);
                queue.complete();
                return Promise.resolve({ value, done: true });
            }
        };
    }
}
