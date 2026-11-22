// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Built-in policies for appends without an explicit concurrency scope. */
export enum ConcurrencyScopeStrategies {
    /** Do not derive a scope or read the tail; no concurrency check is requested. */
    none = 'none',
    /** Derive a scope from registered routing dimensions and the scoped tail (the default). */
    optimistic = 'optimistic'
}
