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

function duration(name: string): Histogram {
    return { record: (value, attributes, context) => metrics.getMeter(ChronicleMeterName, clientVersion)
        .createHistogram(name, {
            description: 'Duration of completed event append RPCs, including returned rejections.',
            unit: 's',
            advice: { explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] }
        }).record(value, attributes, context) };
}

/** Shared-convention instruments. Durations are seconds; batch size is not a dimension. */
export const ChronicleConventionMetrics = {
    eventsAppended: counter(names.metrics.eventsAppended, 'Number of individual events appended to an event sequence.', '{event}'),
    batchAppendsPerformed: counter(names.metrics.batchAppendsPerformed, 'Number of batch-append operations.', '{operation}'),
    eventStoreRetrievals: counter(names.metrics.eventStoreRetrievals, 'Number of event store retrieval operations.', '{operation}'),
    appendDuration: duration(names.metrics.appendDuration),
    appendManyDuration: duration(names.metrics.appendManyDuration),
    constraintViolations: counter(names.metrics.constraintViolations, 'Number of constraint violations encountered during event appends.', '{violation}'),
    appendErrors: counter(names.metrics.appendErrors, 'Number of errors encountered during event appends.', '{error}')
};

/** Accept historical input keys, but emit only bounded-by-configuration canonical dimensions. */
function sharedAttributes(attributes: Attributes = {}): Attributes {
    const legacyInputAttributes = {
        eventStore: 'chronicle.event_store',
        namespace: 'chronicle.namespace',
        eventSequenceId: 'chronicle.event_sequence_id',
        eventTypeId: 'chronicle.event_type_id'
    } as const;
    const result: Attributes = {};
    for (const name of ['eventStore', 'namespace', 'eventSequenceId', 'eventTypeId'] as const) {
        const value = attributes[names.attributes[name]] ?? attributes[legacyInputAttributes[name]];
        if (value !== undefined) result[names.attributes[name]] = value;
    }
    return result;
}

function adaptCounter(shared: Counter): Counter {
    return { add: (value, attributes, context) => shared.add(value, sharedAttributes(attributes), context) };
}

function adaptMilliseconds(shared: Histogram): Histogram {
    return { record: (milliseconds, attributes, context) => shared.record(milliseconds / 1000, sharedAttributes(attributes), context) };
}

/**
 * Compatibility adapters accepting milliseconds and historical attribute keys, emitting only canonical metrics.
 * @deprecated Use ChronicleConventionMetrics with seconds and canonical attribute keys.
 * Continue passing milliseconds here: duration adapters convert to seconds exactly once.
 */
export const ChronicleMetrics = {
    eventsAppended: adaptCounter(ChronicleConventionMetrics.eventsAppended),
    batchAppendsPerformed: adaptCounter(ChronicleConventionMetrics.batchAppendsPerformed),
    eventStoreRetrievals: adaptCounter(ChronicleConventionMetrics.eventStoreRetrievals),
    appendDuration: adaptMilliseconds(ChronicleConventionMetrics.appendDuration),
    appendManyDuration: adaptMilliseconds(ChronicleConventionMetrics.appendManyDuration),
    constraintViolations: adaptCounter(ChronicleConventionMetrics.constraintViolations),
    appendErrors: adaptCounter(ChronicleConventionMetrics.appendErrors)
};
