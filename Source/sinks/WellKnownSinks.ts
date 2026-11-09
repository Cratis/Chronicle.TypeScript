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
    SQL: 'SQL',

    /** Neo4j graph sink, the default sink of property graphs. */
    Neo4j: 'Neo4j',

    /** In-memory graph sink, which keeps a property graph in the kernel's memory. */
    InMemoryGraph: 'InMemoryGraph'
} as const;
