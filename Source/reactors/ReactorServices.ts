// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { IEventStore } from '../IEventStore.js';
import type { IReadModels } from '../readModels/IReadModels.js';

/** Services for the observation's owning store and namespace, not an application default store. */
export interface ReactorServices {
    /** The event store that owns this reactor observation. */
    readonly eventStore: IEventStore;
    /** The read models from the same event store (`eventStore.readModels`). */
    readonly readModels: IReadModels;
    /** Aborted when the observation disconnects or the client is disposed. */
    readonly signal: AbortSignal;
}
