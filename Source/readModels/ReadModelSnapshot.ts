// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEvent, Guid as ContractsGuid } from '@cratis/chronicle.contracts';

/**
 * Represents a read model snapshot together with the events that produced it.
 */
export interface ReadModelSnapshot<TReadModel> {
    /** The read model state at the snapshot. */
    readonly readModel: TReadModel;

    /** The events that were applied to reach the snapshot. */
    readonly events: AppendedEvent[];

    /** When the snapshot occurred. */
    readonly occurred: Date | undefined;

    /** The correlation identifier for the snapshot, when available. */
    readonly correlationId: ContractsGuid | undefined;
}
