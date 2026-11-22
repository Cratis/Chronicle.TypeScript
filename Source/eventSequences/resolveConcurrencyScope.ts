// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConcurrencyScope } from './ConcurrencyScope.js';
import { ConcurrencyScopeStrategies } from './ConcurrencyScopeStrategies.js';
import type { ConcurrencyScopeStrategy } from './ConcurrencyScopeStrategy.js';
import type { ConcurrencyScopeStrategyContext } from './ConcurrencyScopeStrategyContext.js';
import { deriveConcurrencyScope, type RequiredGuard } from './resolveEventSourceRouting.js';

/** Resolves a single or batch append's scope, always preserving an explicit caller scope. */
export async function resolveConcurrencyScope(
    strategy: ConcurrencyScopeStrategy,
    explicitScope: ConcurrencyScope | undefined,
    context: ConcurrencyScopeStrategyContext,
    guard?: RequiredGuard
): Promise<ConcurrencyScope | undefined> {
    if (explicitScope !== undefined) return explicitScope;
    if (typeof strategy === 'function') return await strategy(context);
    if (strategy === ConcurrencyScopeStrategies.optimistic && guard) {
        return await deriveConcurrencyScope(guard.routing, context.eventSourceId, guard.streamId, context.readTail);
    }
    return undefined;
}
