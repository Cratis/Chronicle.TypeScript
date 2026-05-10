// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// This file MUST be imported before any other application code so that the
// OpenTelemetry SDK is fully initialised before the first instrumented call.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------
// Describes this service to all backends. Override SERVICE_NAME and
// SERVICE_VERSION via environment variables before starting the process, e.g.:
//   SERVICE_NAME=my-service node dist/index.js
// ---------------------------------------------------------------------------
const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'chronicle-test-app',
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '1.0.0'
});

// ---------------------------------------------------------------------------
// Exporters
// ---------------------------------------------------------------------------
// OTLP HTTP exporters send data to any OTLP-compatible backend (Jaeger, Tempo,
// Grafana, Honeycomb, Dynatrace, etc.).  Point them at your collector endpoint
// via the standard OTEL_EXPORTER_OTLP_ENDPOINT environment variable, e.g.:
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node dist/index.js
// ---------------------------------------------------------------------------
const telemetryEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const telemetryEnabled = typeof telemetryEndpoint === 'string' && telemetryEndpoint.trim().length > 0;

const traceExporter = telemetryEnabled ? new OTLPTraceExporter() : undefined;
const metricExporter = telemetryEnabled ? new OTLPMetricExporter() : undefined;

// ---------------------------------------------------------------------------
// SDK
// ---------------------------------------------------------------------------
const sdk = telemetryEnabled
    ? new NodeSDK({
        resource,
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter!,
            // Export metrics every 10 seconds (override via OTEL_METRIC_EXPORT_INTERVAL).
            exportIntervalMillis: parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? '', 10) || 10_000
        }),
        // Auto-instrumentation patches popular Node.js libraries (http, grpc, dns,
        // fs, etc.) automatically — no code changes needed for those libraries.
        instrumentations: [getNodeAutoInstrumentations()]
    })
    : undefined;

if (sdk) {
    sdk.start();

    // Ensure the SDK is shut down cleanly when the process exits so that any
    // buffered spans and metrics are flushed to the exporter.
    process.on('SIGTERM', async () => {
        await sdk.shutdown();
        process.exit(0);
    });

    process.on('beforeExit', async () => {
        await sdk.shutdown();
    });
}
