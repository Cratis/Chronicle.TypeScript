// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventContext } from '../events/EventContext.js';
import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { EventGenerationDelivery } from '../observation/EventGenerationDelivery.js';

/** Defines local callbacks without opening a stream. */
export interface IReactorBuilder {
    on<T>(eventType: Constructor<T>, handler: (event: T, context: EventContext) => void | Promise<void>): this;
    /** Subscribes to the event types known when this definition is built, not future types. */
    subscribe(handler: (event: unknown, context: EventContext) => void | Promise<void>): this;
    onEventSequence(eventSequenceId: EventSequenceId | string): this;
    notReplayable(): this;
    /** Selects generation delivery. Pinned requires kernel 19.41.0 or later. */
    withEventGenerationDelivery(delivery: EventGenerationDelivery): this;
}
