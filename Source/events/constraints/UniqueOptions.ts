// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConstraintEventSequence } from './ConstraintEventSequences.js';

/** Options for the {@link unique} decorator. Mirrors the .NET UniqueAttribute. */
export interface UniqueOptions {
    /** Optional shared constraint name; defaults to the class or property name. */
    name?: string;

    /** Optional fixed violation message. */
    message?: string;

    /**
     * The event sequences the constraint applies to. Empty or omitted means every event sequence.
     * When several declarations share a constraint name, their event sequences are combined, and a
     * declaration naming none keeps the constraint applying to every event sequence.
     */
    eventSequences?: ConstraintEventSequence[];
}
