// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import type { ReadModelReactorMetadata } from './ReadModelReactorMetadata.js';

const metadataKey = 'chronicle:readModelReactor';

/** Marks a class with optional added, modified and removed instance methods as a read-model reactor. */
export function readModelReactor<T>(readModel: Constructor<T>, id = '') {
    return (target: Function, _context?: ClassDecoratorContext): void => {
        if (Reflect.hasOwnMetadata(metadataKey, target)) throw new Error(`Duplicate read-model reactor metadata on ${target.name}.`);
        const metadata: ReadModelReactorMetadata = { readModel, id: id || target.name };
        Reflect.defineMetadata(metadataKey, metadata, target);
        TypeDiscoverer.default.register(DecoratorType.ReadModelReactor, target as Constructor, metadata.id);
    };
}

/** Gets only explicitly declared class metadata, never metadata inherited from a base class. */
export function getReadModelReactorMetadata(type: Function): ReadModelReactorMetadata | undefined {
    return Reflect.getOwnMetadata(metadataKey, type);
}

/** Validates convention methods without activating the reactor. Inherited methods are supported. */
export function getReadModelReactorHandlers(type: Constructor): string[] {
    if (!getReadModelReactorMetadata(type)) throw new Error(`Missing @readModelReactor metadata on ${type.name}.`);
    const handlers = ['added', 'modified', 'removed'].filter(name => {
        let prototype = type.prototype;
        while (prototype && prototype !== Object.prototype) {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
            if (descriptor) {
                if (typeof descriptor.value !== 'function') throw new Error(`${type.name}.${name} must be an instance method.`);
                return true;
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return false;
    });
    if (!handlers.length) throw new Error(`${type.name} must declare an added, modified or removed method.`);
    return handlers;
}
