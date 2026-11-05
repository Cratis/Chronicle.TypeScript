// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationOrigin } from './ObservationOrigin.js';
import type { BatchContextValues } from './BatchContextValues.js';

/**
 * Describes the page of events a batch method is called for. It is read-only, and only batch methods receive it:
 * per-event methods never get a {@link BatchContext}.
 */
export class BatchContext {
    /** The identifier of the observer (reactor or reducer). */
    readonly observerId: string;

    /** The event store the events come from. */
    readonly eventStore: string;

    /** The namespace the events come from. */
    readonly namespace: string;

    /** The event sequence the events come from. */
    readonly eventSequenceId: string;

    /** The path the page came from: live, catch-up, replay or retry. */
    readonly origin: ObservationOrigin;

    /** The partitions (event source identifiers) in the page, in the order the kernel delivered them. */
    readonly partitions: readonly string[];

    /** The number of events in the page. */
    readonly eventCount: number;

    /** The sequence number of the first event in the page, or undefined when the page is empty. */
    readonly firstSequenceNumber: bigint | undefined;

    /** The sequence number of the last event in the page, or undefined when the page is empty. */
    readonly lastSequenceNumber: bigint | undefined;

    /** When the kernel stops waiting for the result, or undefined when it waits without a deadline. */
    readonly deadline: Date | undefined;

    /** Aborted when the observation disconnects or the client is disposed. */
    readonly signal: AbortSignal;

    /**
     * Whether the kernel accepts deferred partitions for this page. A kernel that delivers single partitions
     * instead of pages cannot defer; a deferral is then reported as a failure.
     */
    readonly canDefer: boolean;

    /**
     * Creates a new {@link BatchContext}.
     * @param values - The values describing the page.
     */
    constructor(values: BatchContextValues) {
        this.observerId = values.observerId;
        this.eventStore = values.eventStore;
        this.namespace = values.namespace;
        this.eventSequenceId = values.eventSequenceId;
        this.origin = values.origin;
        this.partitions = Object.freeze([...values.partitions]);
        this.eventCount = values.eventCount;
        this.firstSequenceNumber = values.firstSequenceNumber;
        this.lastSequenceNumber = values.lastSequenceNumber;
        this.deadline = values.deadline;
        this.signal = values.signal;
        this.canDefer = values.canDefer;
        Object.freeze(this);
    }

    /** Whether the page is part of a replay. */
    get isReplay(): boolean {
        return this.origin === ObservationOrigin.Replay;
    }
}
