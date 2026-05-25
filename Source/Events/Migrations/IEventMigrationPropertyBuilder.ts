// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
        targetProperty: keyof TTarget & string,
        sourceProperty: keyof TSource & string,
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
        targetProperty: keyof TTarget & string,
        separator: string,
        ...sourceProperties: (keyof TSource & string)[]
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Rename a source property to a target property.
     * @param targetProperty - The new target property.
     * @param sourceProperty - The existing source property.
     * @returns The builder for continued configuration.
     */
    renamedFrom(
        targetProperty: keyof TTarget & string,
        sourceProperty: keyof TSource & string
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;

    /**
     * Provide a default value for a target property.
     * @param targetProperty - The target property.
     * @param value - The default value.
     * @returns The builder for continued configuration.
     */
    defaultValue(
        targetProperty: keyof TTarget & string,
        value: unknown
    ): IEventMigrationPropertyBuilder<TTarget, TSource>;
}
