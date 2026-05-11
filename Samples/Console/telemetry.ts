// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// This file MUST be imported before any other application code so that the
// OpenTelemetry SDK is fully initialised before the first instrumented call.

import { diag, DiagLogLevel, type DiagLogger } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// ---------------------------------------------------------------------------
// ASP.NET-style console logger
// ---------------------------------------------------------------------------
// Colors via ANSI escape codes (no external dependencies).
// Output format:
//   info: @cratis/chronicle/ChronicleClient[0]
//         Created Chronicle client {"serverAddress":"localhost:35000"}
// ---------------------------------------------------------------------------

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';


function writeLog(
    level: string,
    levelColor: string,
    toStderr: boolean,
    message: string,
    args: unknown[]
): void {
    // OTel's DiagComponentLogger calls the underlying DiagLogger as:
    //   logger.method(namespace, userMessage, ...contextArgs)
    // So `message` is the component namespace and args[0] is the actual log body.
    // Raw OTel internal messages (no component logger) pass the full text as `message`
    // with no extra string arg, so we detect by checking args[0].
    let category: string;
    let body: string;
    let contextArgs: unknown[];

    if (args.length > 0 && typeof args[0] === 'string') {
        category = message;
        body = args[0];
        contextArgs = args.slice(1);
    } else {
        // Internal OTel message — use a generic category.
        category = 'opentelemetry';
        body = message;
        contextArgs = args;
    }

    const extra = contextArgs
        .map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
        .join(' ');

    const detail = extra ? `${body} ${GRAY}${extra}${RESET}` : body;
    const line = `${levelColor}${BOLD}${level}${RESET}: ${GRAY}${category}${RESET}\n      ${detail}`;
    if (toStderr) {
        process.stderr.write(`${line}\n`);
    } else {
        process.stdout.write(`${line}\n`);
    }
}

const aspNetLogger: DiagLogger = {
    error(message: string, ...args: unknown[]) { writeLog('fail', RED,    true,  message, args); },
    warn (message: string, ...args: unknown[]) { writeLog('warn', YELLOW, false, message, args); },
    info (message: string, ...args: unknown[]) { writeLog('info', GREEN,  false, message, args); },
    debug(message: string, ...args: unknown[]) { writeLog('dbug', CYAN,   false, message, args); },
    verbose(message: string, ...args: unknown[]) { writeLog('trce', DIM,  false, message, args); },
};

const logLevelEnv = (process.env.LOG_LEVEL ?? 'debug').toLowerCase();
const diagLevel =
    logLevelEnv === 'verbose' || logLevelEnv === 'trace' ? DiagLogLevel.VERBOSE :
    logLevelEnv === 'info'                                ? DiagLogLevel.INFO    :
    logLevelEnv === 'warn'                                ? DiagLogLevel.WARN    :
    logLevelEnv === 'error'                               ? DiagLogLevel.ERROR   :
                                                            DiagLogLevel.DEBUG;

// Must be set before any OTel SDK initialisation.
diag.setLogger(aspNetLogger, diagLevel);

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
