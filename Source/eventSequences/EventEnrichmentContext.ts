// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { EventType } from '../events/EventType.js';
import type { EventSequenceId } from './EventSequenceId.js';

/** Read-only event and append information available to an enrichment provider. */
export interface EventEnrichmentContext {
    /** The original event. Providers must mutate the serialized content, not this instance. */
    readonly event: Readonly<object>;
    readonly eventType: Readonly<EventType>;
    readonly eventStore: string;
    readonly namespace: string;
    readonly eventSequenceId: EventSequenceId;
    readonly eventSourceId: string;
    readonly correlationId: Guid;
}
