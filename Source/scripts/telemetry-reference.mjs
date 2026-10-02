// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Generates canonical built-in names and retained compatibility mappings from the public constants. */
export function telemetryReference(names) {
    const table = (headers, rows) => [
        `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
    const quote = value => value ? `\`${value}\`` : '—';
    return [
        '### Span names', '', table(['Operation', 'Compatibility constant (not emitted)', 'Built-in name'],
            Object.entries(names.conventionSpans).map(([key, value]) => [quote(key), quote(names.spans[key]), quote(value)])), '',
        '### Attribute names', '', table(['Concept', 'Compatibility name', 'Canonical name'],
            Object.entries(names.attributes).map(([key, value]) => [quote(key), quote(names.legacyAttributes[key]), quote(value)])), '',
        `Only ${quote(names.legacyAttributes.sequenceNumber)} remains emitted by built-in spans, as an exact string. Other compatibility attribute constants remain available but are not emitted.`, '',
        '### Metric names', '', table(['Instrument', 'Compatibility instrument (ChronicleMetrics only)', 'Built-in instrument', 'Compatibility / canonical unit'],
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
