// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';

/**
 * Defines a system that discovers and provides event type migrators.
 */
export interface IEventTypeMigrators {
    /**
     * Gets all discovered migrator types.
     */
    readonly allMigrators: Constructor[];

    /**
     * Gets all migrator types for a specific event type.
     * @param eventType - The event type constructor to get migrators for.
     * @returns Collection of migrator constructors.
     */
    getMigratorsFor(eventType: Constructor): Constructor[];
}
