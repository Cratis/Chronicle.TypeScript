// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext } from './EventContext';
import { EventType } from './EventType';

/**
 * Represents an event that has been appended to an event sequence.
 */
export interface AppendedEvent<TContent = Record<string, unknown>> {
    /** The context of the event. */
    readonly context: EventContext;

    /** The type of the event. */
    readonly eventType: EventType;

    /** The deserialized content of the event. */
    readonly content: TContent;
}
