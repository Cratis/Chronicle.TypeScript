// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { metrics, type Attributes, type Counter, type Histogram } from '@opentelemetry/api';
import { clientVersion } from './connection/clientVersion.js';
import { WellKnownTelemetryNames as names } from './WellKnownTelemetryNames.js';

/** The versioned instrumentation scope shared by Chronicle client traces and metrics. */
export const ChronicleMeterName = names.scope;

/** The Chronicle meter. Applications own SDK configuration and export. */
export const ChronicleMeter = metrics.getMeter(ChronicleMeterName, clientVersion);

// Resolve instruments at recording time: the OTel metrics API does not proxy a meter
// acquired before the application installs its provider. SDKs cache these instruments.
function counter(name: string, description: string, unit: string): Counter {
    return { add: (value, attributes, context) => metrics.getMeter(ChronicleMeterName, clientVersion)
        .createCounter(name, { description, unit }).add(value, attributes, context) };
}

function duration(name: string, unit: 's' | 'ms'): Histogram {
    const scale = unit === 's' ? 0.001 : 1;
    return { record: (value, attributes, context) => metrics.getMeter(ChronicleMeterName, clientVersion)
        .createHistogram(name, {
            description: 'Duration of completed event append RPCs, including returned rejections.',
            unit,
            advice: { explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].map(value => value * scale) }
        }).record(value, attributes, context) };
}

/** Shared-convention instruments. Durations are seconds; batch size is not a dimension. */
export const ChronicleConventionMetrics = {
    eventsAppended: counter(names.metrics.eventsAppended, 'Number of individual events appended to an event sequence.', '{event}'),
    batchAppendsPerformed: counter(names.metrics.batchAppendsPerformed, 'Number of batch-append operations.', '{operation}'),
    eventStoreRetrievals: counter(names.metrics.eventStoreRetrievals, 'Number of event store retrieval operations.', '{operation}'),
    appendDuration: duration(names.metrics.appendDuration, 's'),
    appendManyDuration: duration(names.metrics.appendManyDuration, 's'),
    constraintViolations: counter(names.metrics.constraintViolations, 'Number of constraint violations encountered during event appends.', '{violation}'),
    appendErrors: counter(names.metrics.appendErrors, 'Number of errors encountered during event appends.', '{error}')
};

/** Only the existing bounded-by-configuration dimensions belong on the new instruments. */
function sharedAttributes(attributes: Attributes = {}): Attributes {
    const result: Attributes = {};
    for (const name of ['eventStore', 'namespace', 'eventSequenceId', 'eventTypeId'] as const) {
        const value = attributes[names.attributes[name]] ?? attributes[names.legacyAttributes[name]];
        if (value !== undefined) result[names.attributes[name]] = value;
    }
    return result;
}

function bridgeCounter(legacy: Counter, shared: Counter): Counter {
    return { add: (value, attributes, context) => {
        legacy.add(value, attributes, context);
        shared.add(value, sharedAttributes(attributes), context);
    } };
}

function bridgeDuration(legacy: Histogram, shared: Histogram): Histogram {
    return { record: (milliseconds, attributes, context) => {
        legacy.record(milliseconds, attributes, context);
        shared.record(milliseconds / 1000, sharedAttributes(attributes), context);
    } };
}

/**
 * Compatibility instruments: existing callers still record milliseconds and legacy attributes.
 * Each measurement also records its shared-convention equivalent, without adding sensitive dimensions.
 * @deprecated Prefer ChronicleConventionMetrics (durations in seconds). This API and its dual recording remain available.
 * Replacing the earlier "next major" plan, built-in legacy metric emission ends in an upcoming minor after
 * ADR 0001's one-minor overlap. Compatibility APIs have no removal deadline.
 * See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
 */
export const ChronicleMetrics = {
    eventsAppended: bridgeCounter(counter(names.legacyMetrics.eventsAppended,
        'Number of individual events appended to an event sequence.', '{event}'), ChronicleConventionMetrics.eventsAppended),
    batchAppendsPerformed: bridgeCounter(counter(names.legacyMetrics.batchAppendsPerformed,
        'Number of batch-append operations.', '{operation}'), ChronicleConventionMetrics.batchAppendsPerformed),
    eventStoreRetrievals: bridgeCounter(counter(names.legacyMetrics.eventStoreRetrievals,
        'Number of event store retrieval operations.', '{operation}'), ChronicleConventionMetrics.eventStoreRetrievals),
    appendDuration: bridgeDuration(duration(names.legacyMetrics.appendDuration, 'ms'), ChronicleConventionMetrics.appendDuration),
    appendManyDuration: bridgeDuration(duration(names.legacyMetrics.appendManyDuration, 'ms'), ChronicleConventionMetrics.appendManyDuration),
    constraintViolations: bridgeCounter(counter(names.legacyMetrics.constraintViolations,
        'Number of constraint violations encountered during event appends.', '{violation}'), ChronicleConventionMetrics.constraintViolations),
    appendErrors: bridgeCounter(counter(names.legacyMetrics.appendErrors,
        'Number of errors encountered during event appends.', '{error}'), ChronicleConventionMetrics.appendErrors)
};
