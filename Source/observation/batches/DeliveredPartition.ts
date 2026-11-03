// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEvent } from '@cratis/chronicle.contracts';

/** The events of one partition in a delivery. */
export interface DeliveredPartition {
    /** The partition. */
    readonly partition: string;

    /** The events of the partition, in sequence order. */
    readonly events: readonly AppendedEvent[];

    /** The stored read model state as JSON, for reducers. */
    readonly initialState: string;
}
