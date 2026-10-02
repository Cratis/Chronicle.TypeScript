// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getHandledEventType } from '../events/handles.js';
import type { EventHandler } from './EventHandler.js';
import { getInstanceMethods } from './getInstanceMethods.js';

/** Resolves explicit event constructors first, with camelCase discovery for undecorated methods. */
export function getEventHandlers(type: Constructor, registeredTypes: readonly Constructor[], methods = getInstanceMethods(type)): EventHandler[] {
    const eventTypes = new Map(registeredTypes.flatMap(eventType => {
        const metadata = getEventTypeMetadata(eventType);
        return metadata ? [[eventType, metadata.eventType] as const] : [];
    }));
    const handlers = new Map<string, EventHandler>();
    const addHandler = (eventType: Constructor, methodName: string) => {
        const metadata = eventTypes.get(eventType)!;
        const id = metadata.id.value;
        const previous = handlers.get(id);
        if (previous && previous.methodName !== methodName) {
            throw new Error(`'${(type as Function).name}' has multiple handlers for event type '${id}': '${previous.methodName}' and '${methodName}'.`);
        }
        handlers.set(id, { id, generation: metadata.generation.value, methodName });
    };

    for (const [name, method] of methods) {
        const eventType = getHandledEventType(method);
        if (eventType === undefined) continue;
        if (!eventTypes.has(eventType)) {
            throw new Error(`Handler '${name}' on '${(type as Function).name}' names event type '${(eventType as Function).name}', which has no registered event type. Register that event constructor with the event store.`);
        }
        addHandler(eventType, name);
    }

    for (const eventType of eventTypes.keys()) {
        const className = (eventType as Function).name;
        const name = className.charAt(0).toLowerCase() + className.slice(1);
        const method = methods.get(name);
        if (method && getHandledEventType(method) === undefined) addHandler(eventType, name);
    }
    return [...handlers.values()];
}
