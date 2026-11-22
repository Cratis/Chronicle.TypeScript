// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventEnrichmentContext } from './EventEnrichmentContext.js';

/**
 * Enriches an event's serialized JSON object before append transmission.
 * Providers may add, replace, or remove content properties, including nested values,
 * but must leave JSON-serializable content compatible with the registered event schema.
 * Routing, event type, tags, and other append metadata are not content and cannot be changed here.
 * Providers run and are awaited in registration order; throwing or rejecting prevents transmission.
 */
export type EventEnrichmentProvider = (
    content: Record<string, unknown>,
    context: EventEnrichmentContext
) => void | Promise<void>;
