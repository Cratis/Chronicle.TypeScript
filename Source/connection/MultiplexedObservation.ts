// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventsToObserve, ReactorMessage, ReactorsClient, ReduceOperationMessage, ReducerMessage, ReducersClient } from '@cratis/chronicle.contracts';
import type { MultiplexedObservationChannel } from '../observation/multiplexed/MultiplexedObservationChannel.js';

/** The capability a kernel advertises when it serves every reactor and reducer of a connection over one stream. */
export const multiplexedObservationCapability = 'multiplexed-observation';

/**
 * Decides how observers observe, once the kernel's capabilities are known.
 * @returns The channel to multiplex over, or undefined to observe with one call per observer.
 */
export type MultiplexedObservationSelector = () => Promise<MultiplexedObservationChannel | undefined>;

/**
 * Whether observers multiplex: the option is on and the kernel advertises the capability.
 * @param enabled - Whether multiplexed observation is turned on in the client's options.
 * @param capabilities - What the kernel advertised.
 * @returns True when observers share one stream.
 */
export function shouldMultiplexObservation(enabled: boolean, capabilities: readonly string[]): boolean {
    return enabled && capabilities.includes(multiplexedObservationCapability);
}

/**
 * Opens an observation stream through whatever {@link MultiplexedObservationSelector} decides when the stream is first
 * read, so the choice is made after the kernel's capabilities are known.
 */
function lazily<TIn, TOut>(select: MultiplexedObservationSelector,
    multiplexed: (channel: MultiplexedObservationChannel, messages: AsyncIterable<TIn>, signal: AbortSignal | undefined) => AsyncIterable<TOut>,
    perObserver: (messages: AsyncIterable<TIn>, signal: AbortSignal | undefined) => AsyncIterable<TOut>,
    messages: AsyncIterable<TIn>, signal: AbortSignal | undefined): AsyncIterable<TOut> {
    return {
        [Symbol.asyncIterator](): AsyncIterator<TOut> {
            let inner: AsyncIterator<TOut> | undefined;
            let stopped = false;
            const open = (async () => {
                const channel = await select();
                const stream = channel ? multiplexed(channel, messages, signal) : perObserver(messages, signal);
                inner = stream[Symbol.asyncIterator]();
                if (stopped) void inner.return?.()?.catch(() => undefined);
                return inner;
            })();
            open.catch(() => undefined);
            return {
                async next(): Promise<IteratorResult<TOut>> {
                    return (await open).next();
                },
                async return(): Promise<IteratorResult<TOut>> {
                    stopped = true;
                    if (inner) return inner.return ? inner.return() : { value: undefined, done: true };
                    return { value: undefined, done: true };
                }
            };
        }
    };
}

/**
 * Wraps the reactors service so that observing goes over the multiplexed channel when the selector chooses it.
 * @param perObserver - The service that observes with one call per reactor.
 * @param select - Decides, when a reactor starts to observe, whether to multiplex.
 * @returns A reactors service that observes as decided and is otherwise the one given.
 */
export function multiplexingReactors(perObserver: ReactorsClient, select: MultiplexedObservationSelector): ReactorsClient {
    return {
        ...perObserver,
        observe: (request, options) => lazily<ReactorMessage, EventsToObserve>(select,
            (channel, messages, signal) => channel.observeReactor(messages, { signal }),
            (messages, signal) => perObserver.observe(messages as AsyncIterable<never>, { ...options, signal }),
            request as AsyncIterable<ReactorMessage>, options?.signal)
    };
}

/**
 * Wraps the reducers service so that observing goes over the multiplexed channel when the selector chooses it.
 * @param perObserver - The service that observes with one call per reducer.
 * @param select - Decides, when a reducer starts to observe, whether to multiplex.
 * @returns A reducers service that observes as decided and is otherwise the one given.
 */
export function multiplexingReducers(perObserver: ReducersClient, select: MultiplexedObservationSelector): ReducersClient {
    return {
        ...perObserver,
        observe: (request, options) => lazily<ReducerMessage, ReduceOperationMessage>(select,
            (channel, messages, signal) => channel.observeReducer(messages, { signal }),
            (messages, signal) => perObserver.observe(messages as AsyncIterable<never>, { ...options, signal }),
            request as AsyncIterable<ReducerMessage>, options?.signal)
    };
}
