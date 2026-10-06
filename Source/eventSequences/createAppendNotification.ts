// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import { Tag } from '../events/Tag.js';
import type { NamedTag } from '../events/NamedTag.js';
import type { CausationEntry } from '../events/CausationEntry.js';
import type { AppendResult } from './AppendResult.js';
import type { AppendedEventWithResult } from './AppendedEventWithResult.js';

type Causation = { type: { name: string }; properties: Readonly<Record<string, string>> };

/** Maps client causation to the appendOperations shape once per append operation. */
export function mapAppendNotificationCausation(chain: readonly Causation[]): CausationEntry[] {
    return chain.map(item => ({ type: item.type.name, properties: { ...item.properties } }));
}

/** Maps a successful append into the client-side appendOperations notification shape. */
export function createAppendNotification(
    eventSourceId: string, event: object, result: AppendResult, correlationId: string,
    causation: CausationEntry[], tags: readonly string[], occurredAt = new Date(), namedTags: readonly NamedTag[] = []
): AppendedEventWithResult {
    const eventType = getEventTypeFor(event.constructor);
    return {
        event: {
            context: {
                sequenceNumber: result.sequenceNumber.value, eventSourceId, eventType, occurred: occurredAt, correlationId,
                causation,
                tags: tags.map(value => new Tag(value)),
                namedTags: [...namedTags]
            },
            eventType,
            content: event as Record<string, unknown>
        },
        result
    };
}
