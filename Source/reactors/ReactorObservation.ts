// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventsToObserve, ReactorMessage } from '@cratis/chronicle.contracts';
import { AsyncQueue } from './AsyncQueue.js';
import type { ReactorRegistration } from './ReactorRegistration.js';
import type { ReactorPageDispatcher } from './ReactorPageDispatcher.js';

/** One stream attempt, whose identity is never reused by reconnect or same-ID replacement. */
export class ReactorObservation {
    readonly queue = new AsyncQueue<ReactorMessage>();
    readonly controller = new AbortController();
    private _iterator?: AsyncIterator<EventsToObserve>;

    constructor(readonly registration: ReactorRegistration, readonly connectionId: string) {}

    /** Local teardown does not wait for a server response or an uncooperative callback. */
    stop(): void {
        this.controller.abort();
        this.queue.complete();
        void this._iterator?.return?.()?.catch(() => undefined);
    }

    /** Only transport failures escape through the supplied classifier. */
    async observe(stream: AsyncIterable<EventsToObserve>, dispatcher: ReactorPageDispatcher, callbacks: {
        delivered: () => void;
        failed: (error: unknown) => import('../observation/ObservationStreamOutcome.js').ObservationStreamOutcome;
    }): Promise<import('../observation/ObservationStreamOutcome.js').ObservationStreamOutcome> {
        this._iterator = stream[Symbol.asyncIterator]();
        while (!this.controller.signal.aborted) {
            let next: IteratorResult<EventsToObserve>;
            try {
                next = await this._iterator.next();
            } catch (error) {
                return callbacks.failed(error);
            }
            if (next.done) return 'ended';
            if (this.controller.signal.aborted) return 'stopped';
            callbacks.delivered();
            const result = await dispatcher.dispatch(next.value);
            this.queue.send({ Content: { Value0: undefined, Value1: result } });
        }
        return 'stopped';
    }
}
