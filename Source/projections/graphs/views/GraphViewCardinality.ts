// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents how many related items a relation of a graph view yields.
 */
export enum GraphViewCardinality {
    /** A list of related items. A relation without any related node yields an empty list. */
    Many = 'many',

    /** A single related item. A relation without any related node yields null. */
    One = 'one'
}
