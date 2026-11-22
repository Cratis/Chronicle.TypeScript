// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConcurrencyScope } from './ConcurrencyScope.js';
import type { ConcurrencyScopeStrategies } from './ConcurrencyScopeStrategies.js';
import type { ConcurrencyScopeStrategyContext } from './ConcurrencyScopeStrategyContext.js';

/**
 * A built-in policy or a custom callback returning a scope (or undefined for no check).
 * Custom callbacks may be synchronous or asynchronous. A thrown error or rejected promise
 * fails the whole append before it is sent; it never silently disables concurrency checking.
 * Explicit scopes always win and bypass the callback.
 */
export type ConcurrencyScopeStrategy = ConcurrencyScopeStrategies |
    ((context: ConcurrencyScopeStrategyContext) => ConcurrencyScope | undefined | Promise<ConcurrencyScope | undefined>);
