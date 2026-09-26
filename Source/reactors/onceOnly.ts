// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const METADATA_KEY = 'chronicle:reactor:onceOnly';

/**
 * Reactors replay by default. Excludes a whole reactor from replay, or skips one
 * handler for replayed events. A class-level marker is not inherited by subclasses.
 * This does not prevent ordinary redelivery after a failed partition is retried.
 * @returns A class or method decorator for legacy and standard TypeScript decorators.
 */
export function onceOnly(): ClassDecorator & MethodDecorator & ((value: Function, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void) {
    return (target: object, propertyOrContext?: string | symbol | ClassDecoratorContext | ClassMethodDecoratorContext, descriptor?: PropertyDescriptor) => {
        if (typeof propertyOrContext === 'object') {
            if (propertyOrContext.kind !== 'class' && propertyOrContext.kind !== 'method') {
                throw new TypeError('Once-only can only decorate a reactor class or method.');
            }
            Reflect.defineMetadata(METADATA_KEY, true, target);
        } else if (propertyOrContext === undefined) {
            Reflect.defineMetadata(METADATA_KEY, true, target);
        } else if (descriptor?.value) {
            Reflect.defineMetadata(METADATA_KEY, true, descriptor.value);
        } else {
            throw new TypeError('Once-only can only decorate a reactor class or method.');
        }
    };
}

/** Whether this class or handler is marked as once-only (without inheriting the marker). */
export function isOnceOnly(target: Function): boolean {
    return Reflect.getOwnMetadata(METADATA_KEY, target) === true;
}
