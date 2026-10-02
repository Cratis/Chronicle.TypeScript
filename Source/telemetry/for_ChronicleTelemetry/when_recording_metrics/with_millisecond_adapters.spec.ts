// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it } from 'vitest';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { ChronicleMetrics, ChronicleConventionMetrics } from '../../../Metrics.js';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';
import { clientVersion } from '../../../connection/clientVersion.js';
import type { ScopeMetrics } from '@opentelemetry/sdk-metrics';

chai.should();
const telemetry = telemetrySession();
describe('when recording through the deprecated millisecond compatibility bridge', () => {
    let scope: ScopeMetrics;
    const attributes = Object.freeze({ 'chronicle.event_store': 'store', 'chronicle.namespace': 'namespace',
        'chronicle.event_sequence_id': 'event-log', 'chronicle.event_type_id': 'recorded',
        'chronicle.events_count': 237, 'chronicle.event_source_id': 'private-source',
        'cratis.correlation_id': 'private-correlation', tenant: 'custom-dimension' });
    beforeAll(async () => {
        // Metrics was imported before provider installation: recording must still reach the SDK.
        for (const instrument of ['eventsAppended', 'batchAppendsPerformed', 'eventStoreRetrievals', 'constraintViolations', 'appendErrors'] as const) {
            ChronicleMetrics[instrument].add(3, attributes);
        }
        for (const instrument of ['appendDuration', 'appendManyDuration'] as const) {
            ChronicleMetrics[instrument].record(250, attributes);
            // Canonical keys take precedence over historical input keys; direct seconds are not converted.
            ChronicleConventionMetrics[instrument].record(0.5, { 'cratis.event_store.name': 'direct' });
            ChronicleMetrics[instrument].record(1250, { 'chronicle.event_store': 'ignored', 'cratis.event_store.name': 'canonical-input' });
        }
        scope = (await telemetry.reader.collect()).resourceMetrics.scopeMetrics[0];
    });
    it('should use the shared scope and installed version for both families', () => {
        scope.scope.should.include({ name: 'Cratis.Chronicle.Client', version: clientVersion });
    });
    it('should retain dual recording for every compatibility instrument', () => {
        scope.metrics.map(metric => metric.descriptor.name).should.have.members([
            ...Object.values(names.metrics), ...Object.values(names.legacyMetrics)
        ]);
    });
    for (const instrument of ['appendDuration', 'appendManyDuration'] as const) {
        it(`should retain ${instrument} milliseconds and record seconds exactly once`, () => {
            const legacy = scope.metrics.find(metric => metric.descriptor.name === names.legacyMetrics[instrument])!;
            legacy.descriptor.unit.should.equal('ms');
            legacy.dataPoints.should.have.lengthOf(2);
            legacy.dataPoints.find(point => point.attributes['chronicle.event_store'] === 'store')!.value.should.include({
                min: 250, max: 250, sum: 250, count: 1
            });
            legacy.dataPoints.find(point => point.attributes['chronicle.event_store'] === 'ignored')!.value.should.include({
                min: 1250, max: 1250, sum: 1250, count: 1
            });
            const canonical = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            canonical.descriptor.unit.should.equal('s');
            canonical.dataPoints.should.have.lengthOf(3);
            canonical.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'store')!.value.should.include({
                min: 0.25, max: 0.25, sum: 0.25, count: 1
            });
            canonical.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'canonical-input')!.value.should.include({
                min: 1.25, max: 1.25, sum: 1.25, count: 1
            });
        });
        it(`should leave direct ${instrument} seconds unchanged without emitting a legacy measurement`, () => {
            const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'direct')!.value.should.include({
                min: 0.5, max: 0.5, sum: 0.5, count: 1
            });
            const legacy = scope.metrics.find(metric => metric.descriptor.name === names.legacyMetrics[instrument])!;
            legacy.dataPoints.filter(point => point.attributes['cratis.event_store.name'] === 'direct').should.be.empty;
        });
        it(`should retain millisecond and second bucket boundaries for ${instrument}`, () => {
            const milliseconds = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
            for (const [name, boundaries] of [
                [names.legacyMetrics[instrument], milliseconds],
                [names.metrics[instrument], milliseconds.map(value => value / 1000)]
            ] as const) {
                const metric = scope.metrics.find(metric => metric.descriptor.name === name)!;
                metric.dataPoints[0].value.should.have.nested.property('buckets.boundaries').deep.equal(boundaries);
            }
        });
    }
    it('should preserve counter values in both families without scaling or duplication', () => {
        for (const metric of scope.metrics.filter(metric => !metric.descriptor.name.endsWith('_duration'))) {
            metric.dataPoints.should.have.lengthOf(1);
            metric.dataPoints[0].value.should.equal(3);
        }
    });
    it('should preserve every caller attribute on the legacy measurements', () => {
        for (const metric of scope.metrics.filter(metric => metric.descriptor.name.startsWith('chronicle.'))) {
            metric.dataPoints.find(point => point.attributes['chronicle.event_store'] === 'store')!.attributes.should.deep.equal(attributes);
        }
    });
    it('should keep canonical dimensions bounded without forwarding custom or sensitive dimensions', () => {
        for (const metric of scope.metrics.filter(metric => metric.descriptor.name.startsWith('cratis.'))) {
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'store')!.attributes.should.deep.equal({
                'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
                'cratis.event_sequence.id': 'event-log', 'cratis.event_type.id': 'recorded'
            });
        }
    });
});
