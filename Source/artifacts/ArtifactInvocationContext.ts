// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReplayState } from '@cratis/chronicle.contracts';
import type { EventContext } from '../events/EventContext.js';
import { ArtifactDelivery } from './ArtifactDelivery.js';

/** Metadata for a single invocation within an activated artifact's delivery lease. */
export type ArtifactInvocationContext = {
    /** An event handler invocation; each event has its own context, even within a shared batch lease. */
    readonly delivery: ArtifactDelivery.Events;
    /** The context of the event currently being handled. */
    readonly eventContext: EventContext;
    /** The handler method invoked for this event. */
    readonly methodName: string;
} | {
    /** A replay lifecycle notification, activated separately from event batches. */
    readonly delivery: ArtifactDelivery.ReplayNotification;
    /** The replay transition being notified. */
    readonly replayState: ReplayState;
};
