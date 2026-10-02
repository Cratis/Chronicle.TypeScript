// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHmac } from 'node:crypto';
import { SpanStatusCode, type Span, type AttributeValue } from '@opentelemetry/api';
import { WellKnownTelemetryNames as names } from '../WellKnownTelemetryNames.js';
import type { ChronicleTelemetryOptions } from './ChronicleTelemetryOptions.js';

/** Records a canonical shared or product-specific attribute. */
export function setTelemetryAttribute(span: Span, name: keyof typeof names.attributes, value: AttributeValue): void {
    span.setAttribute(names.attributes[name], value);
}

/** Preserves the exact compatibility string; records the canonical integer only when exactly representable. */
export function setSequenceNumber(span: Span, value: bigint): void {
    span.setAttribute(names.legacyAttributes.sequenceNumber, value.toString());
    const number = Number(value);
    if (Number.isSafeInteger(number)) span.setAttribute(names.attributes.sequenceNumber, number);
}

/** Records an event source identifier only under the client's explicit privacy policy. */
export function setEventSourceId(span: Span, value: string | undefined, options?: ChronicleTelemetryOptions): void {
    try {
        const policy = options?.eventSourceId;
        if (value === undefined || !policy || !span.isRecording()) return;
        if (policy.mode !== 'raw' && policy.mode !== 'hmac') return;
        const recorded = policy.mode === 'raw' ? value : createHmac('sha256', policy.key).update(value).digest('hex');
        setTelemetryAttribute(span, 'eventSourceId', recorded);
    } catch {
        // Options are validated at construction, but callers can mutate them later.
        // Optional telemetry enrichment must never prevent an RPC or span completion.
    }
}

/** Classifies failures without serializing arbitrary thrown values, messages or stacks. */
export function exceptionType(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
}

/** Records failure type only; preserves the original exception for the caller. */
export function recordSafeException(span: Span, error: unknown): void {
    const type = exceptionType(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.setAttribute(names.attributes.errorType, type);
    span.addEvent('exception', { [names.attributes.exceptionType]: type });
}
