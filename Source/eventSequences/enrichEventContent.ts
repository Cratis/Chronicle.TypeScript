// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventEnrichmentContext } from './EventEnrichmentContext.js';
import type { EventEnrichmentProvider } from './EventEnrichmentProvider.js';

/** Runs the ordered, asynchronous production enrichment stage on already serialized content. */
export async function enrichEventContent(
    content: string,
    context: EventEnrichmentContext,
    providers: readonly EventEnrichmentProvider[]
): Promise<string> {
    if (providers.length === 0) return content;
    const document: unknown = JSON.parse(content);
    if (document === null || typeof document !== 'object' || Array.isArray(document)) {
        throw new Error('Event enrichment requires serialized event content to be a JSON object.');
    }
    for (const provider of providers) {
        await provider(document as Record<string, unknown>, context);
    }
    return JSON.stringify(document);
}
