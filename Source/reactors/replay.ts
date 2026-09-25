// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:reactor:replay';

/**
 * Marks a method as the alternative handler for an event during replay.
 * Without an explicit event type, name the method `replay<EventClassName>`.
 * The regular camelCase handler continues to handle live events.
 * @param eventType - Optional event constructor for a differently named replay handler.
 * @returns A method decorator for legacy and standard TypeScript decorators.
 */
export function replay(eventType?: Function): MethodDecorator & ((value: Function, context: ClassMethodDecoratorContext) => void) {
    return (target: object, propertyOrContext: string | symbol | ClassMethodDecoratorContext, descriptor?: PropertyDescriptor) => {
        const method = typeof propertyOrContext === 'object' ? target : descriptor?.value;
        if (typeof propertyOrContext === 'object' && (propertyOrContext.kind !== 'method' || propertyOrContext.static || propertyOrContext.private)) {
            throw new TypeError('Replay requires a public instance method.');
        }
        if (typeof method !== 'function') {
            throw new TypeError('Replay requires a method.');
        }
        Reflect.defineMetadata(METADATA_KEY, eventType ?? true, method);
    };
}

/** Gets the explicit event type, or the convention marker, for a replay handler. */
export function getReplayEventType(method: Function): Function | true | undefined {
    return Reflect.getOwnMetadata(METADATA_KEY, method) as Function | true | undefined;
}
