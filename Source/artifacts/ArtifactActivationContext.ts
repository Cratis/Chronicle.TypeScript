// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReplayState } from '@cratis/chronicle.contracts';
import type { EventContext } from '../events/EventContext.js';
import type { IEventStore } from '../IEventStore.js';
import type { IReadModels } from '../readModels/IReadModels.js';
import type { ArtifactKind } from './ArtifactKind.js';
import { ArtifactDelivery } from './ArtifactDelivery.js';

/** The observation's owning store and batch metadata, not the upstream provenance of an imported event. */
export type ArtifactActivationContext = {
    /** The artifact category. */
    readonly kind: ArtifactKind;
    /** The registered reactor or reducer identifier. */
    readonly artifactId: string;
    /** The exact store on which this observation was registered. */
    readonly eventStore: IEventStore;
    /** The read models of that same store. */
    readonly readModels: IReadModels;
    /** The observed event sequence identifier. */
    readonly eventSequenceId: string;
    /** The delivered partition. */
    readonly partition: string;
    /** Aborted on disconnect or client disposal. */
    readonly signal: AbortSignal;
} & ({
    /** Identifies an event delivery (one activation for the whole batch). */
    readonly delivery: ArtifactDelivery.Events;
    /** Context of the first handled event in the batch; later events can have different contexts. */
    readonly eventContext: EventContext;
} | {
    /** Identifies a separate replay lifecycle notification. */
    readonly delivery: ArtifactDelivery.ReplayNotification;
    /** The replay transition being notified. */
    readonly replayState: ReplayState;
});
