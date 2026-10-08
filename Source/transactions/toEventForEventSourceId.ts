// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { TransactionalAppendOptions } from './TransactionalAppendOptions.js';
import { mergeNamedTags } from '../events/mergeNamedTags.js';

/**
 * Captures an event and its transactional append metadata as the batch entry appended on commit.
 * Only supplied values become keys, and tags and occurrence time are copied so later caller mutations do not leak in.
 * The concurrency scope is not part of the entry; the unit of work passes it per event source identifier.
 * @param eventSourceId - The event source identifier.
 * @param event - The event payload.
 * @param options - Optional transactional append metadata.
 * @returns The batch entry.
 */
export function toEventForEventSourceId(eventSourceId: string, event: object, options?: TransactionalAppendOptions): EventForEventSourceId {
    const namedTags = mergeNamedTags(options?.namedTags);
    return {
        eventSourceId,
        event,
        ...(options?.eventSource !== undefined ? { eventSource: options.eventSource } : {}),
        ...(options?.eventStream !== undefined ? { eventStream: options.eventStream } : {}),
        ...(options?.eventStreamType !== undefined ? { eventStreamType: options.eventStreamType } : {}),
        ...(options?.eventStreamId !== undefined ? { eventStreamId: options.eventStreamId } : {}),
        ...(options?.eventSourceType !== undefined ? { eventSourceType: options.eventSourceType } : {}),
        ...(options?.occurred !== undefined ? { occurred: new Date(options.occurred.getTime()) } : {}),
        ...(options?.subject !== undefined ? { subject: options.subject } : {}),
        ...(options?.tags !== undefined ? { tags: [...options.tags] } : {}),
        ...(namedTags.length > 0 ? { namedTags } : {})
    };
}
