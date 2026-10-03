// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection/index.js';
import { EventSequence } from './EventSequence.js';
import { EventSequenceId } from './EventSequenceId.js';
import { IEventLog } from './IEventLog.js';
import { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import type { ConstraintViolation } from './ConstraintViolation.js';
import type { IEventSources } from '../eventSources/IEventSources.js';
import type { ChronicleTelemetryOptions } from '../telemetry/ChronicleTelemetryOptions.js';

/**
 * Implements {@link IEventLog} by extending the base {@link EventSequence}.
 * The event log is the default event sequence used for all domain events.
 */
export class EventLog extends EventSequence implements IEventLog {
    constructor(
        eventStoreName: string,
        namespace: string,
        connection: ChronicleConnection,
        unitOfWorkManager: IUnitOfWorkManager,
        resolveConstraintMessage?: (violation: ConstraintViolation) => ConstraintViolation,
        telemetry?: ChronicleTelemetryOptions,
        eventSources?: IEventSources
    ) {
        super(EventSequenceId.eventLog, eventStoreName, namespace, connection, unitOfWorkManager, resolveConstraintMessage, telemetry, eventSources);
    }
}
