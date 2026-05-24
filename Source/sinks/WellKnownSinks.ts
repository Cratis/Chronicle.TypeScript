// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

/**
 * Well-known Chronicle sink identifiers.
 */
export const WellKnownSinks = {
    /** In-memory sink. */
    InMemory: Guid.parse('8a23995d-da0b-4c4c-818b-f97992f26bbf'),

    /** Null sink. */
    Null: Guid.empty,

    /** MongoDB sink. */
    MongoDB: Guid.parse('22202c41-2be1-4547-9c00-f0b1f797fd75'),

    /** SQL sink. */
    SQL: Guid.parse('f7d3a1e2-4b5c-4d6e-8f9a-0b1c2d3e4f5a')
} as const;