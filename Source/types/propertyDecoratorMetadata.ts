// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ChronicleClassDecorator, getStandardMetadata } from './standardDecoratorMetadata.js';

/** A property decorator accepted by both the legacy and standard TypeScript transforms. */
export type ChroniclePropertyDecorator = PropertyDecorator & ((value: undefined, context: ClassFieldDecoratorContext) => void);

/** A decorator applicable to either a class or a public instance field. */
export type ChronicleClassOrPropertyDecorator = ChronicleClassDecorator & ChroniclePropertyDecorator;

/** Dispatches class and field decorations while retaining the legacy invocation shape. */
export function decorateClassOrProperty(legacy: (target: object, property?: string | symbol) => void): ChronicleClassOrPropertyDecorator {
    const propertyDecorator = decorateProperty(legacy);
    return (target: object | undefined, propertyOrContext?: string | symbol | ClassDecoratorContext | ClassFieldDecoratorContext) => {
        if (typeof propertyOrContext === 'object' && propertyOrContext !== null) {
            if (propertyOrContext.kind === 'class') {
                if (typeof target !== 'function') throw new TypeError('Chronicle class decorators require a class constructor.');
                legacy(target);
            } else {
                propertyDecorator(target as undefined, propertyOrContext as ClassFieldDecoratorContext);
            }
            return;
        }
        if (!target) throw new TypeError('Invalid legacy decorator invocation.');
        legacy(target, propertyOrContext);
    };
}

/** Stores standard property annotations on the class metadata object, without constructing an instance. */
export function decorateProperty(legacy: PropertyDecorator): ChroniclePropertyDecorator {
    return (target: object | undefined, keyOrContext: string | symbol | ClassFieldDecoratorContext) => {
        if (typeof keyOrContext === 'object' && keyOrContext !== null) {
            const context = keyOrContext;
            if (target !== undefined || context.kind !== 'field' || context.static || context.private || typeof context.name !== 'string' || !context.metadata) {
                throw new TypeError('Chronicle property decorators require a public instance field with standard decorator metadata.');
            }
            // Legacy decorators use target.constructor to track fields and store type-level annotations.
            // The context.metadata object is owned by this class; never mutate its parent's metadata.
            Object.defineProperty(context.metadata, 'constructor', { value: context.metadata, configurable: true });
            legacy(context.metadata, context.name);
            return;
        }
        if (!target || (typeof keyOrContext !== 'string' && typeof keyOrContext !== 'symbol')) {
            throw new TypeError('Invalid legacy property decorator invocation.');
        }
        legacy(target, keyOrContext);
    };
}

/** Reads an annotation declared by either decorator transform on a class field. */
export function getPropertyMetadata<T>(key: string, target: object, property: string): T | undefined {
    const ownLegacy = Reflect.getOwnMetadata(key, target, property) as T | undefined;
    if (ownLegacy !== undefined) return ownLegacy;
    const type = (target as { constructor?: Function }).constructor;
    const metadata = type && getStandardMetadata(type);
    const ownStandard = metadata && Reflect.getOwnMetadata(key, metadata, property) as T | undefined;
    if (ownStandard !== undefined) return ownStandard;
    return Reflect.getMetadata(key, target, property) as T | undefined
        ?? (metadata ? Reflect.getMetadata(key, metadata, property) as T | undefined : undefined);
}

/** Checks whether either decorator transform declared an annotation on a class field. */
export function hasPropertyMetadata(key: string, target: object, property: string): boolean {
    const type = (target as { constructor?: Function }).constructor;
    const metadata = type && getStandardMetadata(type);
    return Reflect.hasMetadata(key, target, property) || !!metadata && Reflect.hasMetadata(key, metadata, property);
}

/** Reads a type-level annotation emitted by a standard field decorator (or its legacy equivalent). */
export function getTypeOrFieldMetadata<T>(key: string, type: Function): T | undefined {
    const ownLegacy = Reflect.getOwnMetadata(key, type) as T | undefined;
    if (ownLegacy !== undefined) return ownLegacy;
    const metadata = getStandardMetadata(type);
    const ownStandard = metadata && Reflect.getOwnMetadata(key, metadata) as T | undefined;
    if (ownStandard !== undefined) return ownStandard;
    return Reflect.getMetadata(key, type) as T | undefined
        ?? (metadata ? Reflect.getMetadata(key, metadata) as T | undefined : undefined);
}
