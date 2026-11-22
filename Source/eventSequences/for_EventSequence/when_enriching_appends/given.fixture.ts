// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { EventSequence, EventSequenceId, type EventEnrichmentProvider } from '../../index.js';
import { eventType, NamedTag } from '../../../events/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import type { IUnitOfWorkManager } from '../../../transactions/index.js';

export class EnrichedEvent {
    readonly removable = true;
    readonly recordedAt = new Date('2026-01-01T00:00:00.000Z');
    constructor(readonly value = 'original', readonly nested = { value: 'original' }) {}
}
eventType('enrichment-event')(EnrichedEvent);

export enum AppendMode { single, namedSingle, batch, batchForOneSource, namedBatch }
export const modes = [AppendMode.single, AppendMode.namedSingle, AppendMode.batch, AppendMode.batchForOneSource, AppendMode.namedBatch];

export function a_sequence(providers: readonly EventEnrichmentProvider[] = []) {
    const single = { Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } };
    const batch = async (request: { Events: unknown[] }) =>
        ({ Response: { SequenceNumbers: request.Events.map((_, index) => BigInt(index)), ConstraintViolations: [], Errors: [] } });
    const append = vi.fn().mockResolvedValue(single);
    const appendWithNamedTags = vi.fn().mockResolvedValue(single);
    const appendManyForEventSources = vi.fn().mockImplementation(batch);
    const appendManyForEventSourcesWithNamedTags = vi.fn().mockImplementation(batch);
    const connection = { eventSequences: { append, appendWithNamedTags, appendManyForEventSources, appendManyForEventSourcesWithNamedTags } } as unknown as ChronicleConnection;
    return {
        sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {} as IUnitOfWorkManager, undefined, undefined, undefined, providers),
        calls: [append, appendWithNamedTags, appendManyForEventSources, appendManyForEventSourcesWithNamedTags]
    };
}

export const correlationId = '00000000-0000-0000-0000-000000000211';

export async function append_events(sequence: EventSequence, mode: AppendMode, events = [new EnrichedEvent()]) {
    const options = { correlationId, tags: ['kept'], streamType: 'orders', streamId: 'stream' };
    const namedOptions = { ...options, namedTags: [new NamedTag('tenant', 'one')] };
    switch (mode) {
        case AppendMode.single: return sequence.append('source', events[0], options);
        case AppendMode.namedSingle: return sequence.append('source', events[0], namedOptions);
        case AppendMode.batch: return sequence.appendMany(events.map(event => ({ eventSourceId: 'source', event })), options);
        case AppendMode.batchForOneSource: return sequence.appendMany('source', events, options);
        case AppendMode.namedBatch: return sequence.appendMany(events.map(event => ({ eventSourceId: 'source', event })), namedOptions);
    }
}

export function transmitted(calls: ReturnType<typeof a_sequence>['calls']) {
    const request = calls.flatMap(call => call.mock.calls)[0][0];
    const events: { Content: string; Tags: string[]; EventSourceId: string; EventType: { Id: string }; EventStreamId: string }[] = request.Events ?? [request];
    return { request, events, contents: events.map(event => JSON.parse(event.Content) as Record<string, unknown>) };
}
