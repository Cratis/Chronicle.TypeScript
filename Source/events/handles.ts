// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';

const METADATA_KEY = 'chronicle:events:handles';

/**
 * Selects the event type handled by a reactor or reducer method instead of its camelCase name.
 * The event type must be registered with the owning event store.
 * @param eventType - The event constructor handled by this method.
 * @returns A method decorator for legacy and standard TypeScript decorators.
 */
export function handles(eventType: Constructor): MethodDecorator & ((value: Function, context: ClassMethodDecoratorContext) => void) {
    return (target: object, propertyOrContext: string | symbol | ClassMethodDecoratorContext, descriptor?: PropertyDescriptor) => {
        const isStandard = typeof propertyOrContext === 'object';
        const method = isStandard ? target : descriptor?.value;
        const name = isStandard ? propertyOrContext.name : propertyOrContext;
        if ((isStandard && (propertyOrContext.kind !== 'method' || propertyOrContext.static || propertyOrContext.private)) ||
            (!isStandard && typeof target === 'function') || typeof name !== 'string' || typeof method !== 'function') {
            throw new TypeError('Handles requires a public, string-named instance method.');
        }
        if (typeof eventType !== 'function') {
            throw new TypeError('Handles requires an event constructor.');
        }
        if (Reflect.hasOwnMetadata(METADATA_KEY, method)) {
            throw new TypeError(`Handler '${name}' can only declare @handles once.`);
        }
        Reflect.defineMetadata(METADATA_KEY, eventType, method);
    };
}

/** Gets the explicit event constructor for a handler, without inheriting metadata. */
export function getHandledEventType(method: Function): Constructor | undefined {
    return Reflect.getOwnMetadata(METADATA_KEY, method) as Constructor | undefined;
}
