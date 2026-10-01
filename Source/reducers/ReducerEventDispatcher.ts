// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getEventHandlers } from '../observation/getEventHandlers.js';
import type { EventContext } from '../events/EventContext.js';
import type { ReducerEventHandler } from './ReducerEventHandler.js';

/** Selects and invokes the same reducer handlers for kernel deliveries and in-process scenarios. */
export class ReducerEventDispatcher {
    readonly handlers: ReducerEventHandler[];

    /** Discovers event methods from the artifact event types. */
    constructor(reducerType: Constructor, eventTypes: readonly Constructor[]) {
        this.handlers = getEventHandlers(reducerType, eventTypes);
    }

    /** Resolves a registered event type, or returns undefined for an unsubscribed event. */
    handlerFor(eventTypeId: string): ReducerEventHandler | undefined {
        return this.handlers.find(handler => handler.id === eventTypeId);
    }

    /** Calls the selected handler with the event, current state, and context. */
    async invoke(
        instance: Record<string, Function>,
        handler: ReducerEventHandler,
        event: unknown,
        currentState: unknown,
        context: EventContext
    ): Promise<unknown> {
        return await instance[handler.methodName](event, currentState, context) as unknown;
    }
}
