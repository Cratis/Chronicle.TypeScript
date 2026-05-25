// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IUnitOfWork } from '../transactions/IUnitOfWork';

/**
 * Defines a transactional event sequence that appends to the current unit of work.
 */
export interface ITransactionalEventSequence {
    /** The current unit of work for the active async call context. */
    readonly unitOfWork: IUnitOfWork;

    /**
     * Adds a single event to the current unit of work.
     * @param eventSourceId - The identifier of the event source.
     * @param event - The event to append.
     */
    append(eventSourceId: string, event: object): Promise<void>;

    /**
     * Adds multiple events to the current unit of work.
     * @param eventSourceId - The identifier of the event source.
     * @param events - The events to append.
     */
    appendMany(eventSourceId: string, events: object[]): Promise<void>;
}
