// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FacetSet } from './FacetSet.js';
import type { PatternQueryOptions } from './PatternQueryOptions.js';

/** Additional context and limits when asking about a moment. */
export interface PatternsAtOptions extends PatternQueryOptions {
    /** Additional facets. The moment's Day and TimeBucket replace any supplied values for those names. */
    readonly alsoConstraining?: FacetSet;
}
