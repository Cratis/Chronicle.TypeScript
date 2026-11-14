// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../../types/index.js';
import { decorateProperty, getPropertyMetadata, type ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import type { GraphViewMemberMetadata } from './GraphViewMemberMetadata.js';

const METADATA_KEY = 'chronicle:graph:view:member';

/**
 * Creates a property decorator that declares a member of a graph view. Members are read in the order they are declared.
 * @param metadata - What the member is.
 * @returns A property decorator.
 */
export function declareGraphViewMember(metadata: GraphViewMemberMetadata): ChroniclePropertyDecorator {
    return decorateProperty((target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        if (Reflect.getOwnMetadata(METADATA_KEY, target, key) !== undefined) {
            throw new TypeError(`The member '${key}' of a graph view can be declared as one kind of member only.`);
        }

        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        Reflect.defineMetadata(METADATA_KEY, metadata, target, key);
    });
}

/**
 * Retrieves the metadata stored by the member decorators of a graph view on a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The metadata, or undefined when the property is not a member of a view.
 */
export function getGraphViewMemberMetadata(target: object, propertyKey: string): GraphViewMemberMetadata | undefined {
    return getPropertyMetadata<GraphViewMemberMetadata>(METADATA_KEY, target, propertyKey);
}
