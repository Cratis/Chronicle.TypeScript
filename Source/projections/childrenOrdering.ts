// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Where a new child goes in its collection. Mirrors the `ChildrenPlacement` contract enum. */
export enum ChildrenPlacement {
    /** New children are added at the end of the collection (the default). */
    Append = 0,

    /** New children are added at the start of the collection. */
    Prepend = 1,

    /** New children are inserted at their sorted position. */
    Sorted = 2
}

/** The direction children are sorted in. Mirrors the `SortDirection` contract enum. */
export enum SortDirection {
    /** Smallest first; children without a value sort first. */
    Ascending = 0,

    /** Largest first; children without a value sort last. */
    Descending = 1
}

/** Plain object shape matching the wire-level `ChildrenOrderingDefinition`. */
export interface ChildrenOrderingDefinitionLike {
    /** Where new children go. */
    Placement: ChildrenPlacement;

    /** The property path on the child to sort by; empty unless {@link ChildrenPlacement.Sorted}. */
    SortBy: string;

    /** The sort direction; only meaningful for {@link ChildrenPlacement.Sorted}. */
    Direction: SortDirection;
}

/**
 * Creates the ordering that adds new children at the start of the collection.
 * @returns The ordering definition.
 */
export function prependOrdering(): ChildrenOrderingDefinitionLike {
    return { Placement: ChildrenPlacement.Prepend, SortBy: '', Direction: SortDirection.Ascending };
}

/**
 * Creates the ordering that inserts new children at their sorted position.
 * @param sortBy - The property path on the child to sort by.
 * @param direction - The sort direction.
 * @returns The ordering definition.
 */
export function sortedOrdering(sortBy: string, direction: SortDirection): ChildrenOrderingDefinitionLike {
    return { Placement: ChildrenPlacement.Sorted, SortBy: sortBy, Direction: direction };
}
