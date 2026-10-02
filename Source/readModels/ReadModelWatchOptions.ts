// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Options for creating a read model watcher. */
export interface ReadModelWatchOptions {
    /** Aborting completes iteration and rejects pending readiness. */
    readonly signal?: AbortSignal;

    /**
     * Resume after transport failure or completion. Defaults to false; registering an
     * onResubscribed callback also opts in while at least one callback is registered.
     * Changes missed during an outage are not replayed; refresh your query after resubscription.
     */
    readonly resume?: boolean;

    /**
     * Opt into failing on overflow instead of applying backpressure. Must be a positive safe integer.
     * By default, pause reads at 1,024 buffered changes after subscription acknowledgment.
     * Before each acknowledgment, keep reading to reach the marker; exceeding 1,024 changes
     * (or this explicit limit) fails iteration and pending readiness rather than dropping changes.
     */
    readonly maxBuffered?: number;
}
