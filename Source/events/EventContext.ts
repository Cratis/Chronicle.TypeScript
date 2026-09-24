// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventType } from './EventType.js';
import { CausationEntry } from './CausationEntry.js';
import { Tag } from './Tag.js';
import type { Identity } from '../identity/Identity.js';

/**
 * Represents contextual information about an appended event.
 */
export interface EventContext {
    /** The sequence number of the event in the event sequence. */
    readonly sequenceNumber: bigint;

    /** The unique identifier of the event source. */
    readonly eventSourceId: string;

    /** The event store, when included by the kernel. */
    readonly eventStore?: string;

    /** The namespace, when included by the kernel. */
    readonly namespace?: string;

    /** The source type returned by the kernel. */
    readonly eventSourceType?: string;

    /** The stream type returned by the kernel. */
    readonly eventStreamType?: string;

    /** The stream identifier returned by the kernel. */
    readonly eventStreamId?: string;

    /** The compliance subject returned by the kernel. */
    readonly subject?: string;

    /** The persisted event hash. */
    readonly hash?: string;

    /** The identity responsible for the event. */
    readonly causedBy?: Identity;

    /** The observation state carried by the delivery. */
    readonly observationState?: number;

    /** The type of the event. */
    readonly eventType: EventType;

    /** The timestamp when the event occurred. */
    readonly occurred: Date;

    /** The correlation identifier for the event. */
    readonly correlationId: string;

    /** The causation chain for the event. */
    readonly causation: ReadonlyArray<CausationEntry>;

    /** The tags the event carries. */
    readonly tags: ReadonlyArray<Tag>;
}
