// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventMigrationPropertyBuilder } from './IEventMigrationPropertyBuilder';

const SPLIT_EXPRESSION = '$split';
const COMBINE_EXPRESSION = '$combine';
const RENAME_EXPRESSION = '$rename';
const DEFAULT_VALUE_EXPRESSION = '$defaultValue';

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
        targetProperty: keyof TTarget & string,
        sourceProperty: keyof TSource & string,
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
        targetProperty: keyof TTarget & string,
        separator: string,
        ...sourceProperties: (keyof TSource & string)[]
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
        targetProperty: keyof TTarget & string,
        sourceProperty: keyof TSource & string
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [RENAME_EXPRESSION]: sourceProperty
        };
        return this;
    }

    /** @inheritdoc */
    defaultValue(
        targetProperty: keyof TTarget & string,
        value: unknown
    ): IEventMigrationPropertyBuilder<TTarget, TSource> {
        this._properties[targetProperty] = {
            [DEFAULT_VALUE_EXPRESSION]: value
        };
        return this;
    }
}
