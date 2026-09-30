// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';

/** A returned event recorded without appending, executing or recursively delivering it. */
export interface RecordedReactorSideEffect {
    readonly kind: 'event';
    readonly value: object;
    readonly target: EventForEventSourceId;
    readonly triggeringContext: EventContext;
    readonly handler: string;
    /** Zero-based index of the source-partition delivery, shared by effects from that batch. */
    readonly deliveryIndex: number;
}
