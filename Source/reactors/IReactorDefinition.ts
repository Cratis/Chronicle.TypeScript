// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { EventType } from '../events/EventType.js';
import type { ReactorEvent } from './ReactorEvent.js';
import type { ReactorId } from './ReactorId.js';

/** An immutable runtime reactor definition. Defining it does not start observation. */
export interface IReactorDefinition {
    readonly id: ReactorId;
    readonly eventSequenceId: EventSequenceId;
    readonly eventTypes: readonly EventType[];
    readonly isReplayable: boolean;
    /** Dispatches an event locally, awaiting callbacks before event-processing acknowledgment. */
    readonly handle: (event: ReactorEvent, signal: AbortSignal) => void | Promise<void>;
}
