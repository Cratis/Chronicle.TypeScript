// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Settings for how a reactor or reducer waits before opening its observation stream again.
 * Every setting is optional; the defaults match the .NET client.
 */
export interface ObservationReconnectBackoffOptions {
    /** The wait in milliseconds after a stream that had worked. Defaults to 2 seconds. */
    baseDelayMs?: number;

    /** The longest wait in milliseconds, however often streams end. Defaults to 60 seconds. */
    maxDelayMs?: number;

    /** How long in milliseconds a stream must stay open to count as having worked. Defaults to 3 minutes. */
    healthyStreamDurationMs?: number;

    /** Returns the current time in milliseconds, measuring how long a stream stayed open. Defaults to `performance.now`. */
    now?: () => number;

    /** Returns a value in [0, 1) choosing where in the upper half of the wait this one lands. Defaults to `Math.random`. */
    nextJitter?: () => number;
}

const finiteOr = (value: number | undefined, fallback: number, isAllowed: (value: number) => boolean): number =>
    value !== undefined && Number.isFinite(value) && isAllowed(value) ? value : fallback;

/**
 * Decides how long one reactor or reducer waits before opening its observation stream again after it ended.
 *
 * A fixed delay is right for one observer and wrong for many: seventy reactors whose streams fail together
 * come back together, every two seconds, against a kernel that is still busy. So each stream that ends without
 * having worked doubles the wait, up to a ceiling, and every wait lands at random in its upper half so a herd
 * spreads out.
 *
 * The wait starts over once a stream has worked: it delivered something, or it stayed open long enough to have
 * been established. A base delay of zero or less is used as it is.
 */
export class ObservationReconnectBackoff {
    /** The default wait after a stream that had worked. */
    static readonly defaultBaseDelayMs = 2_000;

    /** The default longest wait between attempts. */
    static readonly defaultMaxDelayMs = 60_000;

    /**
     * The default time a stream must stay open to count as having worked.
     *
     * It is longer than the kernel takes to give up establishing a stream: the kernel asks a busy observer again
     * on the same stream, up to four attempts of a thirty-second grain call each, before it fails the stream. A
     * shorter threshold would count every such stream as having worked and start the wait over at the base delay.
     */
    static readonly defaultHealthyStreamDurationMs = 180_000;

    private static readonly _maxExponent = 30;

    private readonly _baseDelayMs: number;
    private readonly _maxDelayMs: number;
    private readonly _healthyStreamDurationMs: number;
    private readonly _now: () => number;
    private readonly _nextJitter: () => number;
    private _streamsEndedWithoutWorking = 0;
    private _streamOpenedAt: number;

    /**
     * Creates a new {@link ObservationReconnectBackoff}.
     * @param options - The settings; anything left out uses its default.
     */
    constructor(options: ObservationReconnectBackoffOptions = {}) {
        // A wait that is not a finite number would reach setTimeout as about one millisecond: a hot loop.
        this._baseDelayMs = finiteOr(options.baseDelayMs, ObservationReconnectBackoff.defaultBaseDelayMs, () => true);
        this._maxDelayMs = finiteOr(options.maxDelayMs, ObservationReconnectBackoff.defaultMaxDelayMs, value => value > 0);
        this._healthyStreamDurationMs = finiteOr(options.healthyStreamDurationMs,
            ObservationReconnectBackoff.defaultHealthyStreamDurationMs, value => value >= 0);
        this._now = options.now ?? (() => performance.now());
        this._nextJitter = options.nextJitter ?? Math.random;
        this._streamOpenedAt = this._now();
    }

    /** Records that a new observation stream was opened. */
    streamOpened(): void {
        this._streamOpenedAt = this._now();
    }

    /** Records that the open stream delivered something, which proves it was established. */
    streamDelivered(): void {
        this._streamsEndedWithoutWorking = 0;
    }

    /**
     * Gets how long to wait before opening the stream again, now that the open one has ended.
     * @returns The wait in milliseconds.
     */
    nextDelayMs(): number {
        if (this._baseDelayMs <= 0) {
            return this._baseDelayMs;
        }

        if (this._now() - this._streamOpenedAt >= this._healthyStreamDurationMs) {
            this._streamsEndedWithoutWorking = 0;
        }

        const exponent = Math.min(this._streamsEndedWithoutWorking, ObservationReconnectBackoff._maxExponent);
        this._streamsEndedWithoutWorking++;
        const ceiling = Math.min(this._maxDelayMs, this._baseDelayMs * Math.pow(2, exponent));
        const jitter = 0.5 + 0.5 * Math.min(Math.max(this._nextJitter(), 0), 1);
        return Math.floor(ceiling * jitter);
    }
}
