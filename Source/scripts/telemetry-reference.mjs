// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Generates the public reference from the same constants used by instrumentation. */
export function telemetryReference(names) {
    const table = (headers, rows) => [
        `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
    const quote = value => value ? `\`${value}\`` : '—';
    return [
        '### Span names', '', table(['Operation', 'Legacy name (default)', 'Convention name (opt-in)'],
            Object.entries(names.spans).map(([key, value]) => [quote(key), quote(value), quote(names.conventionSpans[key])])), '',
        '### Attribute names', '', table(['Concept', 'Legacy name', 'Convention name'], [
            ...Object.entries(names.attributes).map(([key, value]) => [quote(key), quote(names.legacyAttributes[key]), quote(value)]),
            ...Object.entries(names.legacyAttributes).filter(([key]) => !(key in names.attributes)).map(([key, value]) => [quote(key), quote(value), '—'])
        ]), '',
        '### Metric names', '', table(['Instrument', 'Legacy name', 'Convention name', 'Legacy / convention unit'],
            Object.entries(names.metrics).map(([key, value]) => [quote(key), quote(names.legacyMetrics[key]), quote(value),
                key.includes('Duration') ? '`ms` / `s`' : quote(({ eventsAppended: '{event}', constraintViolations: '{violation}', appendErrors: '{error}' })[key] ?? '{operation}')]))
    ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { WellKnownTelemetryNames } = await import('../WellKnownTelemetryNames.ts');
    const path = new URL('../../Documentation/observability.md', import.meta.url);
    const current = readFileSync(path, 'utf8');
    const updated = current.replace(/<!-- telemetry-reference:start -->[\s\S]*?<!-- telemetry-reference:end -->/,
        `<!-- telemetry-reference:start -->\n${telemetryReference(WellKnownTelemetryNames)}\n<!-- telemetry-reference:end -->`);
    if (!current.includes('<!-- telemetry-reference:start -->')) throw new Error('Telemetry reference marker missing');
    if (process.argv.includes('--check')) {
        if (updated !== current) throw new Error('Regenerate the telemetry reference with Node.js type stripping: node Source/scripts/telemetry-reference.mjs');
    } else {
        writeFileSync(path, updated);
    }
}
