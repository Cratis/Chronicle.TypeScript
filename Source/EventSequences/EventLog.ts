// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { EventSequence } from './EventSequence';
import { EventSequenceId } from './EventSequenceId';
import { IEventLog } from './IEventLog';
import { IUnitOfWorkManager } from '../Transactions/IUnitOfWorkManager';

/**
 * Implements {@link IEventLog} by extending the base {@link EventSequence}.
 * The event log is the default event sequence used for all domain events.
 */
export class EventLog extends EventSequence implements IEventLog {
    constructor(
        eventStoreName: string,
        namespace: string,
        connection: ChronicleConnection,
        unitOfWorkManager: IUnitOfWorkManager
    ) {
        super(EventSequenceId.eventLog, eventStoreName, namespace, connection, unitOfWorkManager);
    }
}
