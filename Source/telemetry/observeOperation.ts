// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { context, propagation, SpanKind, type Span } from '@opentelemetry/api';
import { ChronicleTracer } from '../Tracing.js';
import { correlationIdManager } from '../correlation/index.js';
import { CorrelationId } from '../correlation/CorrelationId.js';
import { WellKnownTelemetryNames } from '../WellKnownTelemetryNames.js';
import type { ChronicleTelemetryOptions } from './ChronicleTelemetryOptions.js';

/** Opens one client span, scoping the resolved business correlation without generating a new one. */
export function observeOperation<T>(
    operation: keyof typeof WellKnownTelemetryNames.conventionSpans,
    telemetry: ChronicleTelemetryOptions | undefined,
    action: (span: Span) => Promise<T>,
    correlationId?: { toString(): string }
): Promise<T> {
    const names = telemetry?.spanNames === 'convention' ? WellKnownTelemetryNames.conventionSpans : WellKnownTelemetryNames.spans;
    const name = names[operation];
    const resolved = correlationId ? new CorrelationId(correlationId.toString()) : correlationIdManager.scoped;
    const run = () => {
        const active = context.active();
        const key = WellKnownTelemetryNames.attributes.correlationId;
        const correlation = resolved?.toString() ?? propagation.getBaggage(active)?.getEntry(key)?.value;
        const parent = correlation ? propagation.setBaggage(active,
            (propagation.getBaggage(active) ?? propagation.createBaggage()).setEntry(key, { value: correlation })) : active;
        return ChronicleTracer.startActiveSpan(name, {
            kind: SpanKind.CLIENT,
            attributes: correlation ? { [key]: correlation } : {}
        }, parent, action);
    };
    return resolved ? correlationIdManager.run(resolved, run) : run();
}
