// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventMigrationPropertyBuilder } from './IEventMigrationPropertyBuilder';

/**
 * Defines a builder for event migrations.
 */
export interface IEventMigrationBuilder<TTarget, TSource> {
    /**
     * Define property migrations.
     * @param properties - Callback used to configure property migration operations.
     */
    properties(properties: (builder: IEventMigrationPropertyBuilder<TTarget, TSource>) => void): void;
}
