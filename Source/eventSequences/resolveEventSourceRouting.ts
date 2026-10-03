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
