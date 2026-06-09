// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Well-known Chronicle sink type identifiers.
 */
export const WellKnownSinks = {
    /** In-memory sink. */
    InMemory: 'InMemory',

    /** None sink (no sink). */
    None: 'None',

    /** MongoDB sink. */
    MongoDB: 'MongoDB',

    /** SQL sink. */
    SQL: 'SQL'
} as const;
