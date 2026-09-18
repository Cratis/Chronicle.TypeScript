// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Metadata stored by the variantOf class decorator. */
export interface VariantOfMetadata {
    /** The type anchoring the logical identity every variant of this group shares. */
    readonly identity: Function;
    /** The property name on this variant used as its own key, and as the correlation property for reclassified joins. */
    readonly key: string;
}

const METADATA_KEY = 'chronicle:projection:variantOf';

/**
 * Class decorator that declares a read model to be one of several mutually exclusive
 * representations of the same logical entity. Entering one variant removes the entity
 * from every sibling variant of the same identity.
 * @param identity - The type anchoring the logical identity shared by every variant. Does not need to be a read model itself.
 * @param key - The property name on this variant used as its own key.
 * @returns A class decorator.
 */
export function variantOf(identity: Function, key: string): ClassDecorator {
    return (target: object) => {
        const metadata: VariantOfMetadata = { identity, key };
        Reflect.defineMetadata(METADATA_KEY, metadata, target);
    };
}

/**
 * Retrieves variantOf metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns The variantOf metadata, or undefined if the class is not a variant.
 */
export function getVariantOfMetadata(target: Function): VariantOfMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target);
}
