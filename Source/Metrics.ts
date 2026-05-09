// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { metrics } from '@opentelemetry/api';

/**
 * The name of the Chronicle metrics instrumentation library.
 * This matches {@link ChronicleInstrumentationName} from Tracing so that all Chronicle
 * telemetry is grouped under a single instrumentation scope in your observability backend.
 */
export const ChronicleMeterName = '@cratis/chronicle';

/**
 * The OpenTelemetry meter used by the Chronicle client for all metric instrumentation.
 *
 * If your application has configured an OpenTelemetry SDK (e.g. via {@link https://www.npmjs.com/package/@opentelemetry/sdk-node}),
 * Chronicle metrics will automatically flow through it.
 * If no SDK is configured, the no-op meter is used and no overhead is incurred.
 */
export const ChronicleMeter = metrics.getMeter(ChronicleMeterName);

/**
 * Pre-built metric instruments for all Chronicle client operations.
 * These are created once and shared across all invocations.
 */
export const ChronicleMetrics = {
    /**
     * Counts the number of individual events appended to an event sequence.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`, `chronicle.event_type_id`
     */
    eventsAppended: ChronicleMeter.createCounter('chronicle.events.appended', {
        description: 'Number of individual events appended to an event sequence.',
        unit: '{event}'
    }),

    /**
     * Counts the number of batch-append operations performed on an event sequence.
     * Each call to appendMany counts as one batch regardless of how many events it contains.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`, `chronicle.events_count`
     */
    batchAppendsPerformed: ChronicleMeter.createCounter('chronicle.events.batch_appends', {
        description: 'Number of batch-append operations performed on an event sequence.',
        unit: '{operation}'
    }),

    /**
     * Counts the number of event store retrieval operations.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`
     */
    eventStoreRetrievals: ChronicleMeter.createCounter('chronicle.client.event_store_retrievals', {
        description: 'Number of event store retrieval operations.',
        unit: '{operation}'
    }),

    /**
     * Measures the duration of append operations in milliseconds.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`, `chronicle.event_type_id`
     */
    appendDuration: ChronicleMeter.createHistogram('chronicle.events.append_duration', {
        description: 'Duration of individual event append operations.',
        unit: 'ms',
        advice: {
            explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
        }
    }),

    /**
     * Measures the duration of batch-append operations in milliseconds.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`, `chronicle.events_count`
     */
    appendManyDuration: ChronicleMeter.createHistogram('chronicle.events.append_many_duration', {
        description: 'Duration of batch event append operations.',
        unit: 'ms',
        advice: {
            explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
        }
    }),

    /**
     * Counts the number of append constraint violations encountered.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`
     */
    constraintViolations: ChronicleMeter.createCounter('chronicle.events.constraint_violations', {
        description: 'Number of constraint violations encountered during event appends.',
        unit: '{violation}'
    }),

    /**
     * Counts the number of append errors encountered.
     *
     * Attributes: `chronicle.event_store`, `chronicle.namespace`,
     * `chronicle.event_sequence_id`
     */
    appendErrors: ChronicleMeter.createCounter('chronicle.events.append_errors', {
        description: 'Number of errors encountered during event appends.',
        unit: '{error}'
    })
};
