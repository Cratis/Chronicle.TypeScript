// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { EventGenerationDelivery } from '../observation/EventGenerationDelivery.js';

/** Configures the subscriptions of a delegate reactor. */
export interface IReactorDefinitionBuilder {
    withEventType<T>(eventType: Constructor<T>): this;
    onEventSequence(eventSequenceId: EventSequenceId | string): this;
    notReplayable(): this;
    /** Selects generation delivery. Pinned requires kernel 19.41.0 or later. */
    withEventGenerationDelivery(delivery: EventGenerationDelivery): this;
}
