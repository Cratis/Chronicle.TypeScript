// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the result of querying a projection against the event log.
 */
export interface ProjectionQueryResult {
    /** Collection of JSON representations of the resulting read model entries. */
    readonly readModelEntries: ReadonlyArray<string>;
}
