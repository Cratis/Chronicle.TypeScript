// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ResolvedEventRouting } from '../eventSources/ResolvedEventRouting.js';
import { ConcurrencyScopeStrategies } from './ConcurrencyScopeStrategies.js';
import type { ConcurrencyScopeStrategy } from './ConcurrencyScopeStrategy.js';
import type { EventForEventSourceId } from './EventForEventSourceId.js';
import type { PreparedBatchAppend } from './PreparedBatchAppend.js';
import { planDerivedGuards, type RequiredGuard } from './resolveEventSourceRouting.js';

/** Plans one scope per event source id, retaining optimistic guard validation and tail-read order. */
export function planConcurrencyScopeStrategies(
    strategy: ConcurrencyScopeStrategy,
    prepared: PreparedBatchAppend,
    routings: Array<ResolvedEventRouting | undefined>
) {
    const { eventsForEventSourceIds, appendOptions, concurrencyScopes } = prepared;
    const explicitIds = new Set([...concurrencyScopes].filter(([, scope]) => scope !== undefined).map(([id]) => id));
    const guards = strategy === ConcurrencyScopeStrategies.optimistic
        ? planDerivedGuards(routings, eventsForEventSourceIds, appendOptions?.streamId, explicitIds)
        : new Map<string, RequiredGuard>();
    const groups = new Map<string, EventForEventSourceId[]>();
    for (const entry of eventsForEventSourceIds) {
        const group = groups.get(entry.eventSourceId) ?? [];
        group.push(entry);
        groups.set(entry.eventSourceId, group);
    }
    const ids = strategy === ConcurrencyScopeStrategies.optimistic ? [...guards.keys()] : [...groups.keys()];
    return ids.map(eventSourceId => ({ eventSourceId, events: groups.get(eventSourceId)!, guard: guards.get(eventSourceId) }));
}
