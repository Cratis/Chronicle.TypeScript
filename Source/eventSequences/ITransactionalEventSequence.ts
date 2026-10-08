// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { TransactionalAppendOptions } from '../transactions/TransactionalAppendOptions.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';

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
     * @param options - Optional append metadata (routing, subject, occurrence time, tags, named tags, concurrency scope) kept with the event until commit.
     */
    append(eventSourceId: string, event: object, options?: TransactionalAppendOptions): Promise<void>;

    /**
     * Adds multiple events to the current unit of work.
     * @param eventSourceId - The identifier of the event source.
     * @param events - The events to append.
     * @param options - Optional append metadata (routing, subject, occurrence time, tags, named tags, concurrency scope) applied to every event.
     */
    appendMany(eventSourceId: string, events: object[], options?: TransactionalAppendOptions): Promise<void>;
}
