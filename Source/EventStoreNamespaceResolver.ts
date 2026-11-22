// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventStoreNamespaceName } from './EventStoreNamespaceName.js';

/**
 * Resolves the namespace for a getEventStore call that omits its namespace.
 * Returns a non-empty namespace name or a promise of one. Whitespace-only names are invalid.
 * An explicit namespace bypasses this callback, and an absent resolver uses the default namespace.
 *
 * Called once per retrieval in the caller's context, before the store cache lookup. Applications
 * own context propagation (for example, AsyncLocalStorage); no HTTP framework or claims model is
 * assumed. Concurrent calls may resolve different namespaces. Do not store a current tenant in
 * shared mutable state: the client retains stores by resolved namespace, not a current namespace.
 *
 * A thrown error, rejected promise, or invalid result rejects getEventStore without falling back
 * to the default namespace. A missing tenant should therefore throw rather than return a default.
 */
export type EventStoreNamespaceResolver = () => string | EventStoreNamespaceName | Promise<string | EventStoreNamespaceName>;
