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
describe('when recording through the deprecated millisecond adapters', () => {
    let scope: ScopeMetrics;
    beforeAll(async () => {
        // Metrics was imported before provider installation: recording must still reach the SDK.
        const attributes = { 'chronicle.event_store': 'store', 'chronicle.namespace': 'namespace',
            'chronicle.event_sequence_id': 'event-log', 'chronicle.event_type_id': 'recorded',
            'chronicle.events_count': 237, 'chronicle.event_source_id': 'private-source',
            'cratis.correlation_id': 'private-correlation', tenant: 'custom-dimension' };
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
    it('should use the shared scope and installed version', () => {
        scope.scope.should.include({ name: 'Cratis.Chronicle.Client', version: clientVersion });
    });
    it('should emit exactly the canonical metric family and no legacy instruments', () => {
        scope.metrics.map(metric => metric.descriptor.name).should.have.members(Object.values(names.metrics));
        scope.metrics.filter(metric => metric.descriptor.name.startsWith('chronicle.') || metric.descriptor.unit === 'ms').should.be.empty;
    });
    for (const instrument of ['appendDuration', 'appendManyDuration'] as const) {
        it(`should convert ${instrument} milliseconds to seconds exactly once without duplicate recording`, () => {
            const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            metric.descriptor.unit.should.equal('s');
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'store')!.value.should.include({
                min: 0.25, max: 0.25, sum: 0.25, count: 1
            });
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'canonical-input')!.value.should.include({
                min: 1.25, max: 1.25, sum: 1.25, count: 1
            });
        });
        it(`should leave direct ${instrument} seconds unchanged`, () => {
            const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'direct')!.value.should.include({
                min: 0.5, max: 0.5, sum: 0.5, count: 1
            });
        });
    }
    it('should preserve counter values without scaling or duplication', () => {
        for (const metric of scope.metrics.filter(metric => !metric.descriptor.name.endsWith('_duration'))) {
            metric.dataPoints[0].value.should.equal(3);
        }
    });
    it('should translate historical dimensions and drop batch size, sensitive and custom dimensions', () => {
        for (const metric of scope.metrics) {
            metric.dataPoints.find(point => point.attributes['cratis.event_store.name'] === 'store')!.attributes.should.deep.equal({
                'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
                'cratis.event_sequence.id': 'event-log', 'cratis.event_type.id': 'recorded'
            });
        }
    });
});
