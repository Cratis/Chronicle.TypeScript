// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationReconnectBackoff } from '../../ObservationReconnectBackoff.js';

/** A backoff with a 2 second base, a 60 second ceiling and a 3 minute healthy threshold, on a clock and jitter the spec controls. */
export class a_backoff {
    static readonly baseDelayMs = 2_000;
    static readonly maxDelayMs = 60_000;
    static readonly healthyStreamDurationMs = 180_000;

    now = 0;
    jitter = 0;

    readonly backoff = new ObservationReconnectBackoff({
        baseDelayMs: a_backoff.baseDelayMs,
        maxDelayMs: a_backoff.maxDelayMs,
        healthyStreamDurationMs: a_backoff.healthyStreamDurationMs,
        now: () => this.now,
        nextJitter: () => this.jitter
    });

    /** Opens a stream, lets it stay open for a while and ends it, returning the wait before the next one. */
    streamEndsAfter(openForMs: number): number {
        this.backoff.streamOpened();
        this.now += openForMs;
        return this.backoff.nextDelayMs();
    }
}
