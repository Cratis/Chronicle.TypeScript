// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import type { JsonSchema } from '../schemas/JsonSchema.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';
import { isMeasuredNumericFormat, isMeasuredText, measuredNumericKey } from './MeasuredConstraintKeys.js';
import { isMeasuredCasingShape, isMeasuredCasingText, measuredLowerInvariant } from './MeasuredCaseFolding.js';

type KeyContext = { name: string; fractions: boolean; measured: boolean; casing: boolean };
type Claim = { key: string; parts: Array<{ property: string; raw: string }> };

// Only characters captured by the packaged oracle, not every valid event-content character.
const provenString = /^[A-Za-z0-9 .@_:\-|{}$\u00e9]*$/;

function guidKey(value: unknown, name: string): string {
    if (isDashedGuid(value)) return value.toLowerCase();
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', name, 'Only dashed Guid keys are fixture-backed.');
}

function isDashedGuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

function isDecimalFraction(value: number): boolean {
    // constraints-fractional-field-types.json: below 0.0001 .NET uses exponent strings, unlike JS.
    // The rounding/boundary vectors match JS below 1e15; keep larger fractions conservatively rejected.
    return Number.isFinite(value) && Math.abs(value) >= 0.0001 && Math.abs(value) < 1e15;
}

function numericKey(value: unknown, context: KeyContext): string {
    if (isSupportedNumber(value, context.fractions)) return String(value);
    const reason = context.fractions
        ? 'Only safe-integer or fractional numeric keys with magnitude at least 0.0001 and below 1e15 are fixture-backed; other values require a kernel-backed test.'
        : 'Only safe-integer numeric keys are fixture-backed; fractional, exponential and unsafe-integer comparisons require a kernel-backed test.';
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', context.name, reason);
}

function isSupportedNumber(value: unknown, fractions: boolean): value is number {
    if (typeof value !== 'number') return false;
    return Number.isSafeInteger(value) || fractions && isDecimalFraction(value);
}

function kernelKeyString(value: unknown, context: KeyContext, schema?: JsonSchema): string {
    if (schema?.format === 'guid') return guidKey(value, context.name);
    if (schema?.type === 'number') return schemaNumericKey(value, context, schema.format);
    return scalarKey(value, context);
}

function schemaNumericKey(value: unknown, context: KeyContext, format: string | undefined): string {
    if (isMeasuredNumericFormat(format)) return measuredNumericKey(value, format!, context.name, context.measured);
    return numericKey(value, { ...context, fractions: context.fractions && [undefined, 'double'].includes(format) });
}

function scalarKey(value: unknown, context: KeyContext): string {
    if (typeof value === 'string' && isSupportedString(value, context)) return value;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    throw new UnsupportedEventSequenceOperation('artifacts.constraints', context.name,
        'Only fixture-backed scalar string and boolean keys are supported.');
}

function isSupportedString(value: string, context: KeyContext): boolean {
    return provenString.test(value) || context.measured && isMeasuredText(value) || context.casing && isMeasuredCasingText(value);
}

function supportsFractions(capture: ConstraintCapture): boolean {
    const unique = capture.uniqueConstraint!;
    return isUnscopedCaseSensitive(capture) && !hasPropertyRemovals(capture) &&
        unique.eventDefinitions.every(entry => entry.properties.length === 1);
}

function isUnscopedCaseSensitive(capture: ConstraintCapture): boolean {
    return !Object.values(capture.scope).some(Boolean) && !capture.uniqueConstraint!.ignoreCasing;
}

function hasPropertyRemovals(capture: ConstraintCapture): boolean {
    const unique = capture.uniqueConstraint!;
    return unique.removedWithEventTypeId !== undefined || !!unique.removedWithEventTypeIds?.length;
}

function normalizedKey(joined: string, ignoreCasing: boolean, name: string, casing: boolean): string {
    if (!ignoreCasing) return joined;
    // Scalars were admitted by isMeasuredCasingText, so the measured mapping is total for this text.
    if (casing) return measuredLowerInvariant(joined);
    // The pinned kernel's ToLowerInvariant is proven only for the existing ASCII domain.
    if (!/^[\x20-\x7e]*$/.test(joined)) {
        throw new UnsupportedEventSequenceOperation('artifacts.constraints', name,
            'Case-insensitive keys outside the ASCII key domain are not fixture-backed.');
    }
    return joined.replace(/[A-Z]/g, letter => String.fromCharCode(letter.charCodeAt(0) + 32));
}

/** Kernel keys join declared property strings with '-', not a tuple (constraints-composite.json). */
export function claimOf(name: string, capture: ConstraintCapture, event: AppendedEvent,
    options: { schema?: JsonSchema; isolated: boolean }): Claim | undefined {
    const unique = capture.uniqueConstraint!;
    const properties = unique.eventDefinitions.find(entry => entry.eventTypeId === event.eventType.id.value)?.properties;
    if (properties === undefined) return undefined;
    const fractions = options.isolated && supportsFractions(capture);
    const casing = options.isolated && isMeasuredCasingShape(unique, Object.values(capture.scope).some(Boolean), hasPropertyRemovals(capture));
    const context = { name, fractions, measured: fractions && unique.eventDefinitions.length === 1, casing };
    const parts = properties.map(property => ({ property,
        raw: kernelKeyString(event.content[property], context, options.schema?.properties?.[property]) }));
    const joined = parts.map(part => part.raw).join('-');
    return { key: createHash('sha256').update(normalizedKey(joined, unique.ignoreCasing, name, casing)).digest('hex'), parts };
}
