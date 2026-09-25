// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType } from './DecoratorType.js';
import { TypeDiscoverer } from './TypeDiscoverer.js';
import { ChronicleClassOrPropertyDecorator, ChroniclePropertyDecorator, decorateClassOrProperty, decorateProperty } from './propertyDecoratorMetadata.js';

function register(type: Function): void {
    TypeDiscoverer.default.register(DecoratorType.ReadModel, type as Constructor);
}

/** Registers a mapped class when its property decorator can identify the constructor. */
export function decorateModelBoundProperty(legacy: PropertyDecorator): ChroniclePropertyDecorator {
    const decorate = decorateProperty(legacy);
    return (target: object | undefined, keyOrContext: string | symbol | ClassFieldDecoratorContext) => {
        decorate(target as object, keyOrContext as string);
        if (typeof keyOrContext === 'object') {
            // Standard field decorators do not receive the class constructor. Their initializer
            // runs when the first instance is created; direct queries can also register the type.
            keyOrContext.addInitializer(function () { register((this as object).constructor); });
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
            keyOrContext.addInitializer(function () { register((this as object).constructor); });
        } else if (typeof keyOrContext === 'string' || typeof keyOrContext === 'symbol') {
            register((target as { constructor: Function }).constructor);
        }
    };
}
