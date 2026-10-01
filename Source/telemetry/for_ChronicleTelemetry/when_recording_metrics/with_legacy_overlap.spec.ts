// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { ChronicleMetrics } from '../../../Metrics.js';
import { clientVersion } from '../../../connection/clientVersion.js';
import type { ScopeMetrics } from '@opentelemetry/sdk-metrics';

chai.should();
const telemetry = telemetrySession();
describe('when recording metrics after installing the SDK', () => {
    let scope: ScopeMetrics;
    beforeEach(async () => {
        // Metrics was imported before provider installation: recording must still reach the SDK.
        const attributes = { 'chronicle.event_store': 'store', 'chronicle.namespace': 'namespace',
            'chronicle.event_sequence_id': 'event-log', 'chronicle.events_count': 237 };
        ChronicleMetrics.batchAppendsPerformed.add(1, attributes);
        ChronicleMetrics.appendManyDuration.record(250, attributes);
        scope = (await telemetry.reader.collect()).resourceMetrics.scopeMetrics[0];
    });
    it('should use the shared scope and installed version', () => {
        scope.scope.should.include({ name: 'Cratis.Chronicle.Client', version: clientVersion });
    });
    it('should retain legacy milliseconds while emitting seconds', () => {
        const legacy = scope.metrics.find(metric => metric.descriptor.name === 'chronicle.events.append_many_duration')!;
        const shared = scope.metrics.find(metric => metric.descriptor.name === 'cratis.chronicle.event_sequence.append_many_duration')!;
        legacy.descriptor.unit.should.equal('ms');
        shared.descriptor.unit.should.equal('s');
        legacy.dataPoints[0].value.should.include({ min: 250, max: 250 });
        shared.dataPoints[0].value.should.include({ min: 0.25, max: 0.25 });
    });
    it('should exclude batch size from only the new metric dimensions', () => {
        const legacy = scope.metrics.find(metric => metric.descriptor.name === 'chronicle.events.batch_appends')!;
        const shared = scope.metrics.find(metric => metric.descriptor.name === 'cratis.chronicle.event_sequence.batch_appends')!;
        legacy.dataPoints[0].attributes.should.have.property('chronicle.events_count', 237);
        shared.dataPoints[0].attributes.should.deep.equal({ 'cratis.event_store.name': 'store',
            'cratis.event_store.namespace': 'namespace', 'cratis.event_sequence.id': 'event-log' });
    });
});
