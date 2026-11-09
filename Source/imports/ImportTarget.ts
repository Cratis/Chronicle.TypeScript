// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ImportsClient } from '@cratis/chronicle.contracts';
import type { IEventSources } from '../eventSources/IEventSources.js';

/** The event sequence an import targets, and how to reach the kernel's Imports service. */
export interface ImportTarget {
    /** The Imports service. */
    readonly imports: ImportsClient;

    /** The name of the event store. */
    readonly eventStore: string;

    /** The namespace. */
    readonly namespace: string;

    /** The identifier of the event sequence the events are imported into. */
    readonly eventSequenceId: string;

    /** The registered event sources, for events routed through a definition. */
    readonly eventSources?: IEventSources;
}
