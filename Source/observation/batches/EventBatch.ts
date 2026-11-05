// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventContext } from '../../events/EventContext.js';
import type { EventAndContext } from './EventAndContext.js';
import type { BatchOutcome } from './BatchOutcome.js';
import { BatchOutcomeKind } from './BatchOutcomeKind.js';
import { DeferralNotSupportedByKernel } from './DeferralNotSupportedByKernel.js';
import { PartitionNotInBatch } from './PartitionNotInBatch.js';

/**
 * The events a batch method is called with, in sequence order, and the way it reports partitions it could not handle.
 *
 * Returning normally means every partition in the batch succeeded. Throwing fails every partition in the batch at its
 * first event in the batch. {@link EventBatch.fail} and {@link EventBatch.defer} report a single partition, so the rest
 * of the batch can still succeed.
 */
export class EventBatch implements Iterable<EventAndContext> {
    readonly #events: readonly EventAndContext[];
    readonly #canDefer: boolean;
    readonly #outcomes: BatchOutcome[] = [];

    /**
     * Creates a new {@link EventBatch}.
     * @param events - The events, in sequence order.
     * @param canDefer - Whether the kernel accepts deferred partitions.
     */
    constructor(events: readonly EventAndContext[], canDefer: boolean = true) {
        this.#events = Object.freeze([...events]);
        this.#canDefer = canDefer;
    }

    /** The events in the batch, in sequence order. */
    get events(): readonly EventAndContext[] {
        return this.#events;
    }

    /** The number of events in the batch. */
    get length(): number {
        return this.#events.length;
    }

    /** The partitions (event source identifiers) the batch holds events for, in the order their first event appears. */
    get partitions(): readonly string[] {
        return [...new Set(this.#events.map(event => event.context.eventSourceId))];
    }

    /** The outcomes reported for single partitions, in the order they were reported. */
    get outcomes(): readonly BatchOutcome[] {
        return this.#outcomes;
    }

    /**
     * Gets the events of one event type, narrowed to it.
     * @param eventType - The event constructor.
     * @returns The events of that type, in sequence order.
     */
    ofType<T>(eventType: Constructor<T>): EventAndContext<T>[] {
        return this.#events.filter((event): event is EventAndContext<T> => event.is(eventType));
    }

    /**
     * Fails a partition. Given a partition, it fails from its first event in the batch; given the context of an event,
     * it fails from that event, and the partition's earlier events count as handled.
     * @param partitionOrEvent - The partition (event source identifier), or the {@link EventContext} of the event it fails at.
     * @param error - What went wrong. Defaults to a {@link PartitionFailedInBatch} error.
     */
    fail(partitionOrEvent: string | EventContext, error?: unknown): void {
        const [partition, at] = this.#locate(partitionOrEvent);
        this.#outcomes.push({ partition, at, kind: BatchOutcomeKind.Failed, error, retryAfterMilliseconds: 0 });
    }

    /**
     * Defers a partition: it is not failed, does not count towards quarantine, and is delivered again after a delay.
     * Given a partition, it is delivered again from its first event in the batch; given the context of an event, from that event.
     * When the kernel does not accept deferrals, the partition is failed with {@link DeferralNotSupportedByKernel} instead.
     * @param partitionOrEvent - The partition (event source identifier), or the {@link EventContext} of the event to deliver again from.
     * @param retryAfterMilliseconds - How long to wait, in milliseconds, before the partition is delivered again.
     */
    defer(partitionOrEvent: string | EventContext, retryAfterMilliseconds: number): void {
        const [partition, at] = this.#locate(partitionOrEvent);
        if (!this.#canDefer) {
            this.#outcomes.push({ partition, at, kind: BatchOutcomeKind.Failed, error: new DeferralNotSupportedByKernel(partition), retryAfterMilliseconds: 0 });
            return;
        }
        this.#outcomes.push({ partition, at, kind: BatchOutcomeKind.Deferred, retryAfterMilliseconds: Math.max(0, Math.round(retryAfterMilliseconds)) });
    }

    /** @inheritdoc */
    [Symbol.iterator](): Iterator<EventAndContext> {
        return this.#events[Symbol.iterator]();
    }

    #locate(partitionOrEvent: string | EventContext): [string, bigint] {
        if (typeof partitionOrEvent === 'string') {
            const first = this.#events.find(event => event.context.eventSourceId === partitionOrEvent);
            if (!first) throw new PartitionNotInBatch(partitionOrEvent);
            return [partitionOrEvent, first.context.sequenceNumber];
        }
        const partition = partitionOrEvent.eventSourceId;
        if (!this.#events.some(event => event.context.eventSourceId === partition)) throw new PartitionNotInBatch(partition);
        return [partition, partitionOrEvent.sequenceNumber];
    }
}
