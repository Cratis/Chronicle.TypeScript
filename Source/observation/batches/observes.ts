// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';

const METADATA_KEY = 'chronicle:observation:observes';

/**
 * Makes a reactor or reducer method a batch method and declares one event type it observes. Apply it once per event
 * type; it is the TypeScript equivalent of the C# `[Observes<TEvent>]` attribute.
 *
 * A batch method receives an {@link EventBatch} of every event of the types it observes, in sequence order, and a
 * {@link BatchContext} describing the page. Each event type reaches exactly one method of an observer: a batch method
 * or a per-event method, never both.
 *
 * @param eventType - The event constructor observed by this method. The event type must be registered with the owning event store.
 * @returns A method decorator for legacy and standard TypeScript decorators.
 *
 * @example
 * ```typescript
 * @reactor()
 * class Users {
 *     @observes(UserRegistered)
 *     @observes(UserRenamed)
 *     async index(batch: EventBatch, context: BatchContext): Promise<void> {
 *         // ...
 *     }
 * }
 * ```
 */
export function observes(eventType: Constructor): MethodDecorator & ((value: Function, context: ClassMethodDecoratorContext) => void) {
    return (target: object, propertyOrContext: string | symbol | ClassMethodDecoratorContext, descriptor?: PropertyDescriptor) => {
        const isStandard = typeof propertyOrContext === 'object';
        const method = isStandard ? target : descriptor?.value;
        const name = isStandard ? propertyOrContext.name : propertyOrContext;
        if ((isStandard && (propertyOrContext.kind !== 'method' || propertyOrContext.static || propertyOrContext.private)) ||
            (!isStandard && typeof target === 'function') || typeof name !== 'string' || typeof method !== 'function') {
            throw new TypeError('Observes requires a public, string-named instance method.');
        }
        if (typeof eventType !== 'function') {
            throw new TypeError('Observes requires an event constructor.');
        }
        const observed = (Reflect.getOwnMetadata(METADATA_KEY, method) as Constructor[] | undefined) ?? [];
        if (observed.includes(eventType)) {
            throw new TypeError(`Batch method '${name}' observes '${(eventType as Function).name}' more than once.`);
        }
        Reflect.defineMetadata(METADATA_KEY, [...observed, eventType], method);
    };
}

/**
 * Gets the event constructors a batch method observes, without inheriting metadata.
 * @param method - The method.
 * @returns The observed event constructors, or an empty array when the method is not a batch method.
 */
export function getObservedEventTypes(method: Function): readonly Constructor[] {
    return (Reflect.getOwnMetadata(METADATA_KEY, method) as Constructor[] | undefined) ?? [];
}

/**
 * Checks whether a method is a batch method, that is decorated with {@link observes}.
 * @param method - The method.
 * @returns True when it is a batch method.
 */
export function isBatchMethod(method: Function): boolean {
    return getObservedEventTypes(method).length > 0;
}
