// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { EventSequence, EventSequenceId } from '../../index.js';
import { eventType } from '../../../events/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import type { IUnitOfWorkManager } from '../../../transactions/index.js';
import { ConcurrencyDimensions, type IEventSources } from '../../../eventSources/index.js';

export class Account {}

/** A registered source, optionally requiring a derived tail read. */
export function registered_sources(concurrency = ConcurrencyDimensions.none): IEventSources {
    return {
        getFor: () => ({ type: Account, name: 'Account', description: '', concurrency, streams: [] })
    } as unknown as IEventSources;
}

export class NamedTagRecorded { constructor(readonly value = 'payload') {} }
eventType('NamedTagRecorded')(NamedTagRecorded);

/** An event sequence whose four append calls are recorded. */
export function a_sequence(eventSources?: IEventSources) {
    const single = { Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } };
    const batch = async (request: { Events: unknown[] }) =>
        ({ Response: { SequenceNumbers: request.Events.map((_, index) => BigInt(index)), ConstraintViolations: [], Errors: [] } });
    const append = vi.fn().mockResolvedValue(single);
    const appendWithNamedTags = vi.fn().mockResolvedValue(single);
    const appendManyForEventSources = vi.fn().mockImplementation(batch);
    const appendManyForEventSourcesWithNamedTags = vi.fn().mockImplementation(batch);
    const tailSequenceNumber = vi.fn().mockResolvedValue({ Data: { SequenceNumber: 0n } });
    const connection = { eventSequences: { append, appendWithNamedTags, appendManyForEventSources, appendManyForEventSourcesWithNamedTags, tailSequenceNumber } } as unknown as ChronicleConnection;
    return {
        sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {} as IUnitOfWorkManager, undefined, undefined, eventSources),
        append, appendWithNamedTags, appendManyForEventSources, appendManyForEventSourcesWithNamedTags, tailSequenceNumber
    };
}
