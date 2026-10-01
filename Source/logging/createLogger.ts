// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { context, propagation, trace, isSpanContextValid, type Attributes } from '@opentelemetry/api';
import { correlationIdManager } from '../correlation/index.js';
import { WellKnownTelemetryNames } from '../WellKnownTelemetryNames.js';
import { exceptionType } from '../telemetry/spanAttributes.js';
import { ChronicleLogLevel } from './ChronicleLogLevel.js';
import { DiagChronicleLogger } from './DiagChronicleLogger.js';
import type { IChronicleLogger } from './IChronicleLogger.js';

/** Binds a category to a client-owned sink and adds safe correlation fields. */
export function createLogger(category: string, sink: IChronicleLogger = new DiagChronicleLogger()) {
    const log = (level: ChronicleLogLevel) => (message: string, fields: Record<string, unknown> = {}) => {
        const attributes: Attributes = {};
        for (const [key, value] of Object.entries(fields)) {
            if (key === 'error') {
                attributes['error.type'] = exceptionType(value);
                attributes['exception.type'] = exceptionType(value);
            } else if (key === 'sequenceNumber') {
                const number = Number(value);
                if (Number.isSafeInteger(number)) attributes[WellKnownTelemetryNames.attributes.sequenceNumber] = number;
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                attributes[key] = value;
            } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                attributes[key] = value;
            }
        }
        const active = context.active();
        const correlationKey = WellKnownTelemetryNames.attributes.correlationId;
        const correlation = correlationIdManager.scoped?.toString() ?? propagation.getBaggage(active)?.getEntry(correlationKey)?.value;
        if (correlation) attributes[correlationKey] = correlation;
        const spanContext = trace.getSpanContext(active);
        if (spanContext && isSpanContextValid(spanContext)) {
            attributes.trace_id = spanContext.traceId;
            attributes.span_id = spanContext.spanId;
        }
        try {
            sink.log({ category, level, message, attributes });
        } catch {
            // Diagnostics are not the operation's outcome. A broken sink must not change RPCs or acknowledgements.
        }
    };
    return {
        verbose: log(ChronicleLogLevel.Verbose), debug: log(ChronicleLogLevel.Debug),
        info: log(ChronicleLogLevel.Info), warn: log(ChronicleLogLevel.Warn), error: log(ChronicleLogLevel.Error)
    };
}
