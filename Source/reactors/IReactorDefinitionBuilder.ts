// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';

/** Configures the subscriptions of a delegate reactor. */
export interface IReactorDefinitionBuilder {
    withEventType<T>(eventType: Constructor<T>): this;
    onEventSequence(eventSequenceId: EventSequenceId | string): this;
    notReplayable(): this;
}
