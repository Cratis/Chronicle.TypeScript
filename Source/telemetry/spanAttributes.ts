// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHmac } from 'node:crypto';
import { SpanStatusCode, type Span, type AttributeValue } from '@opentelemetry/api';
import { WellKnownTelemetryNames as names } from '../WellKnownTelemetryNames.js';
import type { ChronicleTelemetryOptions } from './ChronicleTelemetryOptions.js';

/** Records a shared attribute and its legacy alias on the same span. */
export function setTelemetryAttribute(span: Span, name: keyof typeof names.legacyAttributes, value: AttributeValue): void {
    span.setAttribute(names.legacyAttributes[name], value);
    if (name in names.attributes) {
        span.setAttribute(names.attributes[name as keyof typeof names.attributes], value);
    }
}

/** Records a sequence number only when OpenTelemetry can represent it without loss. */
export function setSequenceNumber(span: Span, value: bigint): void {
    const number = Number(value);
    if (Number.isSafeInteger(number)) setTelemetryAttribute(span, 'sequenceNumber', number);
}

/** Applies the same privacy policy to both event source identifier names. */
export function setEventSourceId(span: Span, value: string | undefined, options?: ChronicleTelemetryOptions): void {
    const policy = options?.eventSourceId;
    if (value === undefined || !policy || !span.isRecording()) return;
    const recorded = policy.mode === 'raw' ? value : createHmac('sha256', policy.key).update(value).digest('hex');
    setTelemetryAttribute(span, 'eventSourceId', recorded);
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
