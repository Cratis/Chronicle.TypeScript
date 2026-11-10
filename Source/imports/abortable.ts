// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Waits for a while, unless aborted first.
 * @param milliseconds - How long to wait.
 * @param signal - Rejects the wait with its reason when aborted.
 * @returns A promise that resolves after the wait.
 */
export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return untilAborted(new Promise<void>(resolve => {
        const timer = setTimeout(resolve, milliseconds);
        signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
    }), signal);
}

/**
 * Waits for a promise, unless aborted first. Aborting does not stop the work the promise stands for.
 * @param promise - The promise to wait for.
 * @param signal - Rejects the wait with its reason when aborted.
 * @returns The value of the promise.
 */
export function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            value => { signal.removeEventListener('abort', onAbort); resolve(value); },
            error => { signal.removeEventListener('abort', onAbort); reject(error); });
    });
}

/**
 * Reads a sync or async iterable lazily, stopping as soon as a signal aborts, even while the source is waiting for
 * its next value.
 * @param source - The iterable to read.
 * @param signal - Stops reading when aborted.
 * @returns The values of the source.
 */
export async function* readUntilAborted<T>(source: AsyncIterable<T> | Iterable<T>, signal: AbortSignal): AsyncGenerator<T> {
    const iterator: AsyncIterator<T> | Iterator<T> = Symbol.asyncIterator in source
        ? (source as AsyncIterable<T>)[Symbol.asyncIterator]()
        : (source as Iterable<T>)[Symbol.iterator]();
    let done = false;
    try {
        while (true) {
            const next = await untilAborted(Promise.resolve(iterator.next()), signal);
            if (next.done) { done = true; return; }
            yield next.value;
        }
    } finally {
        // Let the source release what it holds; a source still waiting for its next value is not waited for.
        if (!done) void Promise.resolve(iterator.return?.()).catch(() => undefined);
    }
}
