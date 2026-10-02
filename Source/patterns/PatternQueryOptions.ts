// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Optional limits on a pattern query; omitted values defer to the server's configuration. */
export interface PatternQueryOptions {
    /** Lowest confidence to return, from 0 to 1. Zero selects the server's configured threshold. */
    readonly minimumConfidence?: number;
    /** Maximum number of answers. Zero selects the server's configured default. */
    readonly maximumResults?: number;
}
