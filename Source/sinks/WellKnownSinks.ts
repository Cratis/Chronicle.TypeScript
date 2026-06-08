// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Well-known Chronicle sink type identifiers.
 */
export const WellKnownSinks = {
    /** In-memory sink. */
    InMemory: 'InMemory',

    /** NotSet sink (no sink). */
    NotSet: 'NotSet',

    /** MongoDB sink. */
    MongoDB: 'MongoDB',

    /** SQL sink. */
    SQL: 'SQL'
} as const;
