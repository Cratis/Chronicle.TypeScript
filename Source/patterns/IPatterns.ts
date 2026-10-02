// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BehaviorPattern } from './BehaviorPattern.js';
import type { FacetSet } from './FacetSet.js';
import type { PatternMoment } from './PatternMoment.js';
import type { PatternQueryOptions } from './PatternQueryOptions.js';
import type { PatternsAtOptions } from './PatternsAtOptions.js';

/** Queries behavior established in this event store and namespace. Failed queries reject, not return an empty answer. */
export interface IPatterns {
    /**
     * Finds patterns describing a context, ranked by specificity then confidence.
     * @param scope - Required grouping key, typically a user identifier.
     * @param context - Facets to match, including the action if it is already known.
     * @param options - Optional query limits; defaults come from the server.
     * @returns Matching patterns, or an empty array when nothing is established for this context.
     */
    getPatterns(scope: string, context: FacetSet, options?: PatternQueryOptions): Promise<BehaviorPattern[]>;

    /**
     * Finds what is usually done in a context, ranked by confidence, at most one answer per action.
     * @param scope - Required grouping key, typically a user identifier.
     * @param context - The known situation; answers name the action through their CommandType facet.
     * @param options - Optional query limits; defaults come from the server.
     * @returns Usual actions, or an empty array when nothing is established for this context.
     */
    getUsualActions(scope: string, context: FacetSet, options?: PatternQueryOptions): Promise<BehaviorPattern[]>;

    /**
     * Finds what a scope usually does at a moment through getUsualActions.
     * @param scope - Required grouping key, typically a user identifier.
     * @param moment - An instant and its own offset; defaults to now at the system's local offset.
     * @param options - Additional context and query limits. Derived Day and TimeBucket always take precedence.
     * @returns Usual actions, or an empty array when nothing is established for this moment.
     * @throws {RangeError} If the moment is invalid.
     */
    getPatternsAt(scope: string, moment?: PatternMoment, options?: PatternsAtOptions): Promise<BehaviorPattern[]>;

    /**
     * Gets every pattern established for a scope, without query limits.
     * @param scope - Required grouping key.
     * @returns All patterns held for this scope.
     */
    getPatternsForScope(scope: string): Promise<BehaviorPattern[]>;

    /**
     * Lists scopes with established patterns in this event store and namespace.
     * @returns The grouping keys of scopes holding patterns.
     */
    getScopes(): Promise<string[]>;
}
