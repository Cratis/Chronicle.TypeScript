// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConcurrencyDimensions } from '../eventSources/ConcurrencyDimensions.js';
import { ResolvedEventRouting } from '../eventSources/ResolvedEventRouting.js';
import type { IEventSources } from '../eventSources/IEventSources.js';
import type { AppendOptions } from './AppendOptions.js';
import type { ConcurrencyScope } from './ConcurrencyScope.js';
import type { EventForEventSourceId } from './EventForEventSourceId.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';

/** Resolves the definition routing of a single append, or undefined for a legacy append. */
export function resolveSingleRouting(eventSources: IEventSources | undefined, options?: AppendOptions): ResolvedEventRouting | undefined {
    return ResolvedEventRouting.resolve(eventSources, options?.eventSource, options?.eventStream,
        { sourceType: options?.sourceType, streamType: options?.streamType });
}

/** Resolves the definition routing of one event of a batch; per-event values win over the shared options. */
export function resolveBatchRouting(
    eventSources: IEventSources | undefined,
    event: EventForEventSourceId,
    options?: AppendOptions
): ResolvedEventRouting | undefined {
    const ownSource = event.eventSource !== undefined;
    const source = event.eventSource ?? options?.eventSource;
    // A stream belongs to its event source: never inherit the shared stream into a different source.
    const stream = event.eventStream ?? (ownSource ? undefined : options?.eventStream);
    return ResolvedEventRouting.resolve(eventSources, source, stream, {
        sourceType: event.eventSourceType ?? options?.sourceType,
        streamType: event.eventStreamType ?? options?.streamType
    });
}

/** A derived guard required by a registered-definition event of a batch. */
export interface RequiredGuard {
    /** The routing whose dimensions produce the guard. */
    readonly routing: ResolvedEventRouting;
    /** The stream id the guard's stream-id dimension (if any) applies to. */
    readonly streamId: string | undefined;
}

/** The predicate a guard evaluates: only the values of the dimensions the routing selects. */
function guardPredicate(routing: ResolvedEventRouting, eventSourceId: string, streamId: string | undefined): string | undefined {
    const dimensions = routing.dimensions;
    if (dimensions === ConcurrencyDimensions.none) return undefined;
    const has = (flag: number) => (dimensions & flag) !== 0;
    return JSON.stringify([
        has(ConcurrencyDimensions.eventSourceId) ? eventSourceId : null,
        has(ConcurrencyDimensions.eventSourceType) ? routing.sourceType : null,
        has(ConcurrencyDimensions.eventStreamType) ? routing.streamType ?? null : null,
        has(ConcurrencyDimensions.eventStreamId) ? streamId ?? null : null
    ]);
}

/**
 * Determines the single derived guard every event source id of a batch needs.
 * The Kernel accepts one concurrency scope per event source id, so equivalent predicates share one
 * scope (an unguarded event never suppresses a guarded one) and differing predicates are rejected
 * before anything is written.
 * @param routings - The resolved routing per event, aligned with {@link events}.
 * @param events - The batch events.
 * @param sharedStreamId - The shared stream id from the append options.
 * @param explicitIds - Event source ids that carry an explicit scope; they are never derived.
 * @returns The guard to derive per event source id.
 * @throws Error when one event source id needs differing guards.
 */
export function planDerivedGuards(
    routings: Array<ResolvedEventRouting | undefined>,
    events: EventForEventSourceId[],
    sharedStreamId: string | undefined,
    explicitIds: ReadonlySet<string> = new Set()
): Map<string, RequiredGuard> {
    const guards = new Map<string, { guard: RequiredGuard; predicate: string }>();
    routings.forEach((routing, index) => {
        const { eventSourceId, eventStreamId } = events[index];
        if (!routing || explicitIds.has(eventSourceId)) return;
        const streamId = eventStreamId ?? sharedStreamId;
        const predicate = guardPredicate(routing, eventSourceId, streamId);
        if (predicate === undefined) return;
        const existing = guards.get(eventSourceId);
        if (!existing) {
            guards.set(eventSourceId, { guard: { routing, streamId }, predicate });
        } else if (existing.predicate !== predicate) {
            throw new Error(
                `Event source id '${eventSourceId}' needs differing concurrency guards within one batch ` +
                `('${existing.guard.routing.eventSource}' and '${routing.eventSource}'), but Chronicle accepts one concurrency scope per event source id. ` +
                'Pass an explicit shared concurrencyScopes entry for the id, or append the events in separate batches.');
        }
    });
    return new Map([...guards].map(([id, { guard }]) => [id, guard]));
}

/** The tail reader a derived concurrency scope needs. */
export type TailReader = (eventSourceId?: string, sourceType?: string, streamType?: string, streamId?: string) => Promise<EventSequenceNumber>;

/**
 * Derives an optimistic concurrency scope from the dimensions a definition declares.
 * Only call this when no explicit scope exists; explicit scopes always win.
 * @returns The scope, or undefined when the definition declares no dimensions.
 */
export async function deriveConcurrencyScope(
    routing: ResolvedEventRouting,
    eventSourceId: string,
    streamId: string | undefined,
    readTail: TailReader
): Promise<ConcurrencyScope | undefined> {
    const dimensions = routing.dimensions;
    if (dimensions === ConcurrencyDimensions.none) return undefined;

    const has = (flag: number) => (dimensions & flag) !== 0;
    const scopedSource = has(ConcurrencyDimensions.eventSourceId) ? eventSourceId : undefined;
    const scopedSourceType = has(ConcurrencyDimensions.eventSourceType) ? routing.sourceType : undefined;
    const scopedStreamType = has(ConcurrencyDimensions.eventStreamType) ? routing.streamType : undefined;
    const scopedStreamId = has(ConcurrencyDimensions.eventStreamId) ? streamId : undefined;

    const tail = await readTail(scopedSource, scopedSourceType, scopedStreamType, scopedStreamId);
    return {
        // An empty scope is checked against "no matching event", like an explicit first append.
        sequenceNumber: tail.value === EventSequenceNumber.unset.value ? EventSequenceNumber.beforeFirst.value : tail.value,
        eventSourceId: scopedSource !== undefined,
        eventSourceType: scopedSourceType,
        eventStreamType: scopedStreamType,
        eventStreamId: scopedStreamId
    };
}
