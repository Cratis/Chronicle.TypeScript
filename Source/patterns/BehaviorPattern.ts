// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FacetSet } from './FacetSet.js';

/** Recurring behavior established by Chronicle, not a prediction invented by the client. */
export interface BehaviorPattern {
    /** Identity of the persisted pattern. */
    readonly id: string;
    /** Scope the behavior belongs to, typically a user. */
    readonly groupingKey: string;
    /** The pattern's context and, when present, its CommandType action. */
    readonly facets: FacetSet;
    /** How often the pattern holds when its context is present, from 0 to 1. */
    readonly confidence: number;
    /** Share of all observed events containing the pattern, from 0 to 1. */
    readonly support: number;
    /** Approximate occurrence count, preserving the wire's 64-bit precision. */
    readonly occurrences: bigint;
    /** Recency-weighted strength. */
    readonly weight: number;
    /** Number of facets the pattern constrains. */
    readonly specificity: number;
    /** First observed instant, absent if the server omitted it. */
    readonly firstSeen: Date | undefined;
    /** Last observed instant, absent if the server omitted it. */
    readonly lastSeen: Date | undefined;
}
