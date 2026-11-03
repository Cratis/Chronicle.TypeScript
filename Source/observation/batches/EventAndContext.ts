// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventContext } from '../../events/EventContext.js';
import type { ReactorDelivery } from '../../reactors/ReactorDelivery.js';

/**
 * One event in an {@link EventBatch}: its content, its context and the event type it was registered as.
 * The content is the deserialized JSON of the event, as per-event handlers receive it.
 */
export class EventAndContext<TEvent = unknown> {
    /**
     * Creates a new {@link EventAndContext}.
     * @param event - The content of the event.
     * @param context - The {@link EventContext} of the event.
     * @param eventType - The registered event constructor the event was appended as.
     * @param delivery - The {@link ReactorDelivery} identifying the event's delivery, for reactors.
     */
    constructor(
        readonly event: TEvent,
        readonly context: EventContext,
        readonly eventType: Constructor,
        readonly delivery?: ReactorDelivery
    ) {
        Object.freeze(this);
    }

    /**
     * Checks whether the event is of a given event type, narrowing {@link event} to it.
     * @param eventType - The event constructor to check for.
     * @returns True when the event was appended as that event type.
     */
    is<T>(eventType: Constructor<T>): this is EventAndContext<T> {
        return this.eventType === eventType;
    }
}
