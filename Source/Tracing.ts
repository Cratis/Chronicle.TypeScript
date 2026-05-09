// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { trace } from '@opentelemetry/api';

/**
 * The name of the Chronicle instrumentation library.
 * Use this name to filter or configure Chronicle client spans in your observability backend.
 */
export const ChronicleInstrumentationName = '@cratis/chronicle';

/**
 * The OpenTelemetry tracer used by the Chronicle client for all instrumentation.
 * This tracer is pre-configured with the Chronicle library name and is used to
 * create spans around every client operation.
 *
 * If your application has configured an OpenTelemetry SDK (e.g. via {@link https://www.npmjs.com/package/@opentelemetry/sdk-node}),
 * Chronicle spans will automatically flow through it.
 * If no SDK is configured, the no-op tracer is used and no overhead is incurred.
 */
export const ChronicleTracer = trace.getTracer(ChronicleInstrumentationName);
