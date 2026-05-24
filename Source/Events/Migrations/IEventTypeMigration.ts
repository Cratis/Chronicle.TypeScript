// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventMigrationBuilder } from './IEventMigrationBuilder';

/**
 * Defines an event type migration.
 */
export interface IEventTypeMigration<TTarget = unknown, TSource = unknown> {
    /**
     * Define the upcast migration.
     * @param builder - The migration builder to use.
     */
    upcast(builder: IEventMigrationBuilder<TTarget, TSource>): void;

    /**
     * Define the downcast migration.
     * @param builder - The migration builder to use.
     */
    downcast(builder: IEventMigrationBuilder<TSource, TTarget>): void;
}
