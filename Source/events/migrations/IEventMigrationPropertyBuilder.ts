// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { MigrationPropertyPath } from './MigrationPropertyPath.js';
import type { ValueMapping } from './ValueMapping.js';

/**
 * Defines a builder for event migration property transformations.
 */
export interface IEventMigrationPropertyBuilder<TTarget, TSource> {
    /**
     * Split a source property value into a target property by extracting one part.
     * @param targetProperty - The target property to write into.
     * @param sourceProperty - The source property to split.
     * @param separator - The separator to split by.
     * @param part - The zero-based part index to extract.
     * @returns The builder for continued configuration.
     */
    split(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>,
        separator: string,
        part: number
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Combine multiple source properties into a single target property by concatenation.
     * @param targetProperty - The target property to write into.
     * @param separator - The separator inserted between source values.
     * @param sourceProperties - Source properties to concatenate.
     * @returns The builder for continued configuration.
     */
    combine(
        targetProperty: MigrationPropertyPath<TTarget>,
        separator: string,
        ...sourceProperties: MigrationPropertyPath<TSource>[]
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Rename a source property to a target property.
     * @param targetProperty - The new target property.
     * @param sourceProperty - The existing source property.
     * @returns The builder for continued configuration.
     */
    renamedFrom(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Provide a default value for a target property.
     * @param targetProperty - The target property.
     * @param value - The default value.
     * @returns The builder for continued configuration.
     */
    defaultValue(
        targetProperty: MigrationPropertyPath<TTarget>,
        value: unknown
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Map payload values using ordered pairs. Unmapped values pass through unchanged;
     * an absent source produces no result. The first matching pair wins. In kernel 19.37.4,
     * object values must use the same property order as the source payload.
     * Directions are independent: no inverse is inferred.
     * @param targetProperty - Root or nested target payload property.
     * @param sourceProperty - Root or nested source payload property.
     * @param mappings - JSON-serializable values (including null, numbers and objects), not enum names.
     * @returns The builder for continued configuration.
     */
    mapValues(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>,
        mappings: readonly ValueMapping[]
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;
}
