// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { EventSequence } from '../../../eventSequences/EventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import type { ChronicleTelemetryOptions } from '../../ChronicleTelemetryOptions.js';

export class Recorded { constructor(readonly value = 'sensitive payload') {} }
eventType('telemetry-recorded')(Recorded);

export function eventSequence(telemetry?: ChronicleTelemetryOptions) {
    const services = {
        append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 42n } }),
        appendManyForEventSources: vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [42n, 43n] } }),
        tailSequenceNumber: vi.fn().mockResolvedValue({ IsAuthorized: true, Data: { SequenceNumber: 42n } }),
        hasEventsForEventSourceId: vi.fn().mockResolvedValue({ IsAuthorized: true, Data: { HasEvents: true } }),
        forEventSourceIdAndEventTypes: vi.fn().mockResolvedValue({ IsAuthorized: true, Data: [] }),
        fromSequenceNumber: vi.fn().mockResolvedValue({ IsAuthorized: true, Data: [] }),
        redact: vi.fn().mockResolvedValue({}),
        redactForEventSource: vi.fn().mockResolvedValue({})
    };
    const connection = { eventSequences: services } as unknown as ChronicleConnection;
    return { services, sequence: new EventSequence(EventSequenceId.eventLog, 'store', 'namespace', connection,
        {} as IUnitOfWorkManager, undefined, telemetry) };
}
