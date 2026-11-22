// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventMigrationPropertyBuilder } from './IEventMigrationPropertyBuilder.js';
import type { MigrationPropertyPath } from './MigrationPropertyPath.js';
import type { ValueMapping } from './ValueMapping.js';

const SPLIT_EXPRESSION = '$split';
const COMBINE_EXPRESSION = '$combine';
const RENAME_EXPRESSION = '$rename';
const DEFAULT_VALUE_EXPRESSION = '$defaultValue';
const MAP_VALUES_EXPRESSION = '$mapValues';

/**
 * Represents an implementation of {@link IEventMigrationPropertyBuilder}.
 */
export class EventMigrationPropertyBuilder<TTarget, TSource> implements IEventMigrationPropertyBuilder<TTarget, TSource> {
    private readonly _properties: Record<string, unknown> = {};

    /**
     * Gets the configured properties.
     */
    get properties(): Record<string, unknown> {
        return this._properties;
    }

    /** @inheritdoc */
    split(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>,
        separator: string,
        part: number
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [SPLIT_EXPRESSION]: {
                source: sourceProperty,
                separator,
                part
            }
        };
        return this;
    }

    /** @inheritdoc */
    combine(
        targetProperty: MigrationPropertyPath<TTarget>,
        separator: string,
        ...sourceProperties: MigrationPropertyPath<TSource>[]
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [COMBINE_EXPRESSION]: {
                sources: sourceProperties,
                separator
            }
        };
        return this;
    }

    /** @inheritdoc */
    renamedFrom(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [RENAME_EXPRESSION]: sourceProperty
        };
        return this;
    }

    /** @inheritdoc */
    defaultValue(
        targetProperty: MigrationPropertyPath<TTarget>,
        value: unknown
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [DEFAULT_VALUE_EXPRESSION]: value
        };
        return this;
    }

    /** @inheritdoc */
    mapValues(
        targetProperty: MigrationPropertyPath<TTarget>,
        sourceProperty: MigrationPropertyPath<TSource>,
        mappings: readonly ValueMapping[]
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [MAP_VALUES_EXPRESSION]: {
                source: sourceProperty,
                mappings: mappings.map(({ from, to }) => ({ from, to }))
            }
        };
        return this;
    }
}
