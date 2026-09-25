// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType } from './DecoratorType.js';
import { TypeDiscoverer } from './TypeDiscoverer.js';
import { ChronicleClassOrPropertyDecorator, ChroniclePropertyDecorator, decorateClassOrProperty, decorateProperty } from './propertyDecoratorMetadata.js';
import { getStandardMetadata, hasOwnStandardMetadata } from './standardDecoratorMetadata.js';

const registered = new WeakSet<Function>();

function register(type: Function): void {
    if (registered.has(type)) return;
    TypeDiscoverer.default.register(DecoratorType.ReadModel, type as Constructor);
    registered.add(type);
}

function registerDeclaringClass(instance: object, metadata: object): void {
    let type: Function | null = instance.constructor;
    while (type && (!hasOwnStandardMetadata(type) || getStandardMetadata(type) !== metadata)) {
        type = Object.getPrototypeOf(type) as Function | null;
    }
    if (type) register(type);
}

/** Registers a mapped class when its property decorator can identify the constructor. */
export function decorateModelBoundProperty(legacy: PropertyDecorator): ChroniclePropertyDecorator {
    const decorate = decorateProperty(legacy);
    return (target: object | undefined, keyOrContext: string | symbol | ClassFieldDecoratorContext) => {
        decorate(target as object, keyOrContext as string);
        if (typeof keyOrContext === 'object') {
            // Standard field decorators do not receive the class constructor. Their initializer
            // runs when the first instance is created; direct queries can also register the type.
            const metadata = keyOrContext.metadata;
            keyOrContext.addInitializer(function () { if (metadata) registerDeclaringClass(this as object, metadata); });
        } else {
            register((target as { constructor: Function }).constructor);
        }
    };
}

/** Registers property mappings without changing class-level decorator behavior. */
export function decorateModelBoundClassOrProperty(legacy: (target: object, property?: string | symbol) => void): ChronicleClassOrPropertyDecorator {
    const decorate = decorateClassOrProperty(legacy);
    return (target: object | undefined, keyOrContext?: string | symbol | ClassDecoratorContext | ClassFieldDecoratorContext) => {
        decorate(target as object, keyOrContext as string);
        if (typeof keyOrContext === 'object' && keyOrContext?.kind === 'field') {
            const metadata = keyOrContext.metadata;
            keyOrContext.addInitializer(function () { if (metadata) registerDeclaringClass(this as object, metadata); });
        } else if (typeof keyOrContext === 'string' || typeof keyOrContext === 'symbol') {
            register((target as { constructor: Function }).constructor);
        }
    };
}
