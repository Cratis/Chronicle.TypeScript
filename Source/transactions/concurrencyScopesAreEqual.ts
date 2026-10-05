// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConcurrencyScope } from '../eventSequences/ConcurrencyScope.js';

/**
 * Compares two concurrency scopes by value.
 * @param first - The first scope.
 * @param second - The second scope.
 * @returns True when both scopes validate the same expectation.
 */
export function concurrencyScopesAreEqual(first: ConcurrencyScope, second: ConcurrencyScope): boolean {
    const eventTypeKeys = (scope: ConcurrencyScope) =>
        (scope.eventTypes ?? []).map(_ => `${_.id.value}+${_.generation.value}`).sort().join(',');

    return first.sequenceNumber === second.sequenceNumber
        && (first.eventSourceId ?? false) === (second.eventSourceId ?? false)
        && first.eventStreamType === second.eventStreamType
        && first.eventStreamId === second.eventStreamId
        && first.eventSourceType === second.eventSourceType
        && (first.eventTypes === undefined) === (second.eventTypes === undefined)
        && eventTypeKeys(first) === eventTypeKeys(second);
}
