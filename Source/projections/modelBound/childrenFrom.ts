// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { decorateModelBoundProperty } from '../../types/modelBoundProperty.js';
import { ChroniclePropertyDecorator, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the childrenFrom property decorator. */
export interface ChildrenFromMetadata {
    /** The event constructor that adds children to the collection. */
    readonly eventType: Function;
    /** Optional child type for TypeScript runtimes without emitted generic metadata. */
    readonly childType?: Function;
    /** The event property name used as the key for children. Defaults to the event source identifier. */
    readonly key?: string;
    /** The child model property name used to uniquely identify instances in the collection. */
    readonly identifiedBy?: string;
    /** The event property name used as the parent key. Defaults to the event source identifier. */
    readonly parentKey?: string;
}

const METADATA_KEY = 'chronicle:projection:childrenFrom';

/**
 * Property decorator that configures a children collection sub-projection from an event type.
 * @param eventType - The event constructor.
 * @param key - Optional event property name to use as the key for children, or the child constructor.
 * @param identifiedBy - Optional child model property name used to identify instances.
 * @param parentKey - Optional event property name used as the parent key.
 * @returns A property decorator.
 */
export function childrenFrom(
    eventType: Function,
    key?: string | Function,
    identifiedBy?: string,
    parentKey?: string
): ChroniclePropertyDecorator {
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
        const propKey = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propKey);
        const existing: ChildrenFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, propKey) ?? [];
        const metadata: ChildrenFromMetadata = {
            eventType, key: typeof key === 'string' ? key : undefined,
            childType: typeof key === 'function' ? key : undefined, identifiedBy, parentKey
        };
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, propKey);
    });
}

/**
 * Retrieves all childrenFrom metadata stored on the given property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns An array of childrenFrom metadata entries.
 */
export function getChildrenFromMetadata(target: object, propertyKey: string): ChildrenFromMetadata[] {
    return getPropertyMetadata<ChildrenFromMetadata[]>(METADATA_KEY, target, propertyKey) ?? [];
}
