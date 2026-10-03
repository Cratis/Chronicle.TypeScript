// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Flags describing which dimensions of an append take part in a concurrency check.
 * Values match the wire contract and can be combined with bitwise OR.
 */
export const ConcurrencyDimensions = {
    /** No dimensions declared; the append keeps its existing concurrency behavior. */
    none: 0,

    /** The event source identifier. */
    eventSourceId: 1,

    /** The event source type. */
    eventSourceType: 2,

    /** The event stream type. */
    eventStreamType: 4,

    /** The event stream identifier. */
    eventStreamId: 8
} as const;

/** A bitwise combination of {@link ConcurrencyDimensions} values. */
export type ConcurrencyDimensionFlags = number;
