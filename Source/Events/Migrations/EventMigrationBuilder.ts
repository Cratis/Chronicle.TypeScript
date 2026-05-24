// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventMigrationPropertyBuilder } from './EventMigrationPropertyBuilder';
import { IEventMigrationBuilder } from './IEventMigrationBuilder';

/**
 * Represents an implementation of {@link IEventMigrationBuilder}.
 */
export class EventMigrationBuilder<TTarget, TSource> implements IEventMigrationBuilder<TTarget, TSource> {
    private readonly _propertyBuilders: EventMigrationPropertyBuilder<TTarget, TSource>[] = [];

    /** @inheritdoc */
    properties(properties: (builder: EventMigrationPropertyBuilder<TTarget, TSource>) => void): void {
        const builder = new EventMigrationPropertyBuilder<TTarget, TSource>();
        properties(builder);
        this._propertyBuilders.push(builder);
    }

    /**
     * Convert the builder to an object representation.
     * @returns The migration object representation.
     */
    toObject(): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const builder of this._propertyBuilders) {
            Object.assign(result, builder.properties);
        }
        return result;
    }
}
