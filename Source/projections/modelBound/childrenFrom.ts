// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { ChildrenOrderingDefinitionLike, prependOrdering, SortDirection, sortedOrdering } from '../childrenOrdering.js';
import { ConflictingChildrenOrdering } from './ConflictingChildrenOrdering.js';
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
    /**
     * Add new children at the start of the collection instead of the end. Ordering belongs to the collection: every
     * childrenFrom on the same property has to agree on it, or leave it unset. Updating an existing child never moves it.
     */
    readonly prepend?: boolean;
    /**
     * Insert new children at their position when sorted ascending by this child property; children without a value sort
     * first. Every childrenFrom on the same property has to agree on the ordering, or leave it unset.
     */
    readonly orderBy?: string;
    /**
     * Insert new children at their position when sorted descending by this child property; children without a value sort
     * last. Every childrenFrom on the same property has to agree on the ordering, or leave it unset.
     */
    readonly orderByDescending?: string;
}

/** Options for the options form of the childrenFrom property decorator. */
export interface ChildrenFromOptions {
    /** The child type, for TypeScript runtimes without emitted generic metadata. */
    readonly childType?: Function;
    /** The event property name used as the key for children. Defaults to the event source identifier. */
    readonly key?: string;
    /** The child model property name used to uniquely identify instances in the collection. */
    readonly identifiedBy?: string;
    /** The event property name used as the parent key. Defaults to the event source identifier. */
    readonly parentKey?: string;
    /**
     * Add new children at the start of the collection instead of the end. Ordering belongs to the collection: every
     * childrenFrom on the same property has to agree on it, or leave it unset. Updating an existing child never moves it.
     */
    readonly prepend?: boolean;
    /**
     * Insert new children at their position when sorted ascending by this child property; children without a value sort
     * first. Every childrenFrom on the same property has to agree on the ordering, or leave it unset.
     */
    readonly orderBy?: string;
    /**
     * Insert new children at their position when sorted descending by this child property; children without a value sort
     * last. Every childrenFrom on the same property has to agree on the ordering, or leave it unset.
     */
    readonly orderByDescending?: string;
}

const METADATA_KEY = 'chronicle:projection:childrenFrom';

/**
 * Property decorator that configures a children collection sub-projection from an event type.
 * Use this form to name the child type and an explicit child key together.
 * @param eventType - The event constructor.
 * @param options - The child type, key, identifiedBy, parentKey and ordering of new children.
 * @returns A property decorator.
 */
export function childrenFrom(eventType: Function, options: ChildrenFromOptions): ChroniclePropertyDecorator;
/**
 * Property decorator that configures a children collection sub-projection from an event type.
 * @param eventType - The event constructor.
 * @param key - Optional event property name to use as the key for children, or the child constructor.
 * @param identifiedBy - Optional child model property name used to identify instances.
 * @param parentKey - Optional event property name used as the parent key.
 * @returns A property decorator.
 */
export function childrenFrom(eventType: Function, key?: string | Function, identifiedBy?: string, parentKey?: string): ChroniclePropertyDecorator;
export function childrenFrom(
    eventType: Function,
    keyOrOptions?: string | Function | ChildrenFromOptions,
    identifiedBy?: string,
    parentKey?: string
): ChroniclePropertyDecorator {
    const metadata = toMetadata(eventType, keyOrOptions, identifiedBy, parentKey);
    return decorateModelBoundProperty((target: object, propertyKey: string | symbol) => {
        const propKey = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, propKey);
        const existing: ChildrenFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target, propKey) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, metadata], target, propKey);
    });
}

function toMetadata(
    eventType: Function,
    keyOrOptions: string | Function | ChildrenFromOptions | undefined,
    identifiedBy: string | undefined,
    parentKey: string | undefined
): ChildrenFromMetadata {
    if (typeof keyOrOptions === 'object' && keyOrOptions !== null) {
        return {
            eventType, childType: keyOrOptions.childType, key: keyOrOptions.key,
            identifiedBy: keyOrOptions.identifiedBy, parentKey: keyOrOptions.parentKey,
            ...(keyOrOptions.prepend === true ? { prepend: true } : {}),
            ...(keyOrOptions.orderBy === undefined ? {} : { orderBy: keyOrOptions.orderBy }),
            ...(keyOrOptions.orderByDescending === undefined ? {} : { orderByDescending: keyOrOptions.orderByDescending })
        };
    }
    return {
        eventType, key: typeof keyOrOptions === 'string' ? keyOrOptions : undefined,
        childType: typeof keyOrOptions === 'function' ? keyOrOptions : undefined, identifiedBy, parentKey
    };
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

/**
 * Resolves the ordering of new children declared by the childrenFrom decorators on a property.
 * @param property - The children property.
 * @param metadataList - The childrenFrom metadata declared on the property.
 * @returns The ordering, or undefined when new children are appended.
 */
export function getChildrenOrdering(property: string, metadataList: readonly ChildrenFromMetadata[]): ChildrenOrderingDefinitionLike | undefined {
    const declared = metadataList.map(metadata => {
        const orderings = [
            metadata.prepend === true ? prependOrdering() : undefined,
            metadata.orderBy === undefined ? undefined : sortedOrdering(metadata.orderBy, SortDirection.Ascending),
            metadata.orderByDescending === undefined ? undefined : sortedOrdering(metadata.orderByDescending, SortDirection.Descending)
        ].filter(ordering => ordering !== undefined);
        if (orderings.length > 1) {
            throw new ConflictingChildrenOrdering(property);
        }
        return orderings[0];
    }).filter(ordering => ordering !== undefined);
    const [first] = declared;
    if (declared.some(ordering => ordering.Placement !== first.Placement || ordering.SortBy !== first.SortBy || ordering.Direction !== first.Direction)) {
        throw new ConflictingChildrenOrdering(property);
    }
    return first;
}
