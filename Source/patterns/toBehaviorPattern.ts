// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BehaviorPatternDetailsResponse } from '@cratis/chronicle.contracts';
import type { BehaviorPattern } from './BehaviorPattern.js';

/**
 * Converts the wire representation without losing 64-bit occurrence counts or inventing missing timestamps.
 * @param pattern - The pattern returned by the kernel.
 * @returns The client representation.
 */
export function toBehaviorPattern(pattern: BehaviorPatternDetailsResponse): BehaviorPattern {
    return {
        id: pattern.Id,
        groupingKey: pattern.GroupingKey,
        facets: { ...pattern.Facets },
        confidence: pattern.Confidence,
        support: pattern.Support,
        occurrences: pattern.Occurrences,
        weight: pattern.Weight,
        specificity: pattern.Specificity,
        firstSeen: pattern.FirstSeen ? new Date(pattern.FirstSeen.Value) : undefined,
        lastSeen: pattern.LastSeen ? new Date(pattern.LastSeen.Value) : undefined
    };
}
