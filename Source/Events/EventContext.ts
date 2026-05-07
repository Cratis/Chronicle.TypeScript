// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventType } from './EventType';

/**
 * Represents contextual information about an appended event.
 */
export interface EventContext {
    /** The sequence number of the event in the event sequence. */
    readonly sequenceNumber: number;

    /** The unique identifier of the event source. */
    readonly eventSourceId: string;

    /** The type of the event. */
    readonly eventType: EventType;

    /** The timestamp when the event occurred. */
    readonly occurred: Date;

    /** The correlation identifier for the event. */
    readonly correlationId: string;

    /** The causation chain for the event. */
    readonly causation: ReadonlyArray<CausationEntry>;
}

/**
 * Represents a single entry in the causation chain of an event.
 */
export interface CausationEntry {
    /** The type identifier of the causing operation. */
    readonly type: string;

    /** The properties associated with the causation entry. */
    readonly properties: Readonly<Record<string, string>>;
}
