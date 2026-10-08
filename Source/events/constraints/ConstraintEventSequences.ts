// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';

/** An event sequence a constraint can be scoped to, by identifier or by its string value. */
export type ConstraintEventSequence = EventSequenceId | string;

/**
 * Normalizes declared event sequences to distinct, nonblank identifier values in declaration order.
 * @param eventSequences - The declared event sequences.
 * @returns The normalized identifier values.
 */
export function normalizeConstraintEventSequences(eventSequences: readonly ConstraintEventSequence[]): string[] {
    const values: string[] = [];
    for (const eventSequence of eventSequences) {
        const value = eventSequence instanceof EventSequenceId ? eventSequence.value : eventSequence;
        if (typeof value !== 'string' || value.trim().length === 0 || values.includes(value)) continue;
        values.push(value);
    }
    return values;
}

/**
 * Combines the event sequences declared for one constraint in more than one place.
 * An empty declaration means every event sequence and wins: combining never narrows a constraint that
 * one declaration applies everywhere. Otherwise the result is the distinct union in declaration order.
 * Mirrors ConstraintEventSequences.Combine in the .NET client.
 * @param declarations - The declarations to combine; undefined or empty means every event sequence.
 * @returns The combined declaration, empty for every event sequence.
 */
export function combineConstraintEventSequences(declarations: ReadonlyArray<readonly string[] | undefined>): string[] {
    if (declarations.length === 0 || declarations.some(declaration => !declaration || declaration.length === 0)) return [];
    const combined: string[] = [];
    for (const declaration of declarations) {
        for (const value of declaration!) {
            if (!combined.includes(value)) combined.push(value);
        }
    }
    return combined;
}
