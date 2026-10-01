// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, beforeEach, afterAll } from 'vitest';
import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader, AggregationTemporality } from '@opentelemetry/sdk-metrics';

/** In-process providers only; no export outside the spec process. */
export function telemetrySession() {
    const spans = new InMemorySpanExporter();
    const traces = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spans)] });
    const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    const reader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 60000 });
    const meters = new MeterProvider({ readers: [reader] });
    const contextManager = new AsyncLocalStorageContextManager();
    beforeAll(() => {
        context.setGlobalContextManager(contextManager.enable());
        trace.setGlobalTracerProvider(traces);
        metrics.setGlobalMeterProvider(meters);
        propagation.setGlobalPropagator(new CompositePropagator({ propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()] }));
    });
    beforeEach(() => spans.reset());
    afterAll(async () => {
        await traces.shutdown();
        await meters.shutdown();
        context.disable();
        trace.disable();
        metrics.disable();
        propagation.disable();
        contextManager.disable();
    });
    return { spans, traces, reader };
}
