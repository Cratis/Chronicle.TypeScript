// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it, vi } from 'vitest';
import type { ScopeMetrics } from '@opentelemetry/sdk-metrics';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { client } from '../given/a_client.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';
import { clientVersion } from '../../../connection/clientVersion.js';

chai.should();
const telemetry = telemetrySession();
describe('when recording metrics from successful client operations', () => {
    let scopes: ScopeMetrics[];
    let scope: ScopeMetrics;
    const sequenceAttributes = {
        'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
        'cratis.event_sequence.id': 'event-log'
    };
    const eventAttributes = { ...sequenceAttributes, 'cratis.event_type.id': 'telemetry-recorded' };

    beforeAll(async () => {
        const instance = client();
        const { sequence, services } = eventSequence();
        let milliseconds = 1000;
        const clock = vi.spyOn(performance, 'now').mockImplementation(() => milliseconds);
        services.append.mockImplementation(async () => {
            milliseconds += 250;
            return { Response: { SequenceNumber: 42n } };
        });
        services.appendManyForEventSources.mockImplementation(async () => {
            milliseconds += 1250;
            return { Response: { SequenceNumbers: [43n, 44n] } };
        });
        try {
            await instance.getEventStore('store', 'namespace');
            await sequence.append('private-source', new Recorded());
            await sequence.appendMany('private-source', [new Recorded(), new Recorded()]);
            scopes = (await telemetry.reader.collect()).resourceMetrics.scopeMetrics;
            scope = scopes[0];
        } finally {
            clock.mockRestore();
            instance.dispose();
        }
    });

    it('should use the canonical scope and installed client version', () => {
        scopes.should.have.lengthOf(1);
        scope.scope.should.include({ name: 'Cratis.Chronicle.Client', version: clientVersion });
    });
    it('should emit only the expected canonical instruments with no legacy names', () => {
        scope.metrics.map(metric => metric.descriptor.name).should.have.members([
            names.metrics.eventsAppended, names.metrics.batchAppendsPerformed, names.metrics.eventStoreRetrievals,
            names.metrics.appendDuration, names.metrics.appendManyDuration
        ]);
        scope.metrics.filter(metric => metric.descriptor.name.startsWith('chronicle.')).should.be.empty;
    });
    it('should record the single append duration in seconds exactly once', () => {
        const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics.appendDuration)!;
        metric.descriptor.unit.should.equal('s');
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0].attributes.should.deep.equal(eventAttributes);
        metric.dataPoints[0].value.should.include({ min: 0.25, max: 0.25, sum: 0.25, count: 1 });
    });
    it('should record the batch append duration in seconds exactly once', () => {
        const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics.appendManyDuration)!;
        metric.descriptor.unit.should.equal('s');
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0].attributes.should.deep.equal(sequenceAttributes);
        metric.dataPoints[0].value.should.include({ min: 1.25, max: 1.25, sum: 1.25, count: 1 });
    });
    it('should count individual events with the dimensions known to each append path', () => {
        const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics.eventsAppended)!;
        metric.dataPoints.map(point => ({ attributes: point.attributes, value: point.value })).should.have.deep.members([
            { attributes: eventAttributes, value: 1 }, { attributes: sequenceAttributes, value: 2 }
        ]);
    });
    it('should count the batch without a batch-size dimension', () => {
        const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics.batchAppendsPerformed)!;
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0].attributes.should.deep.equal(sequenceAttributes);
        metric.dataPoints[0].value.should.equal(1);
    });
    it('should count the event-store retrieval with only store and namespace dimensions', () => {
        const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics.eventStoreRetrievals)!;
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0].attributes.should.deep.equal({
            'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace'
        });
        metric.dataPoints[0].value.should.equal(1);
    });
    it('should exclude legacy, batch-size and sensitive dimensions from every measurement', () => {
        for (const metric of scope.metrics) {
            for (const point of metric.dataPoints) {
                Object.keys(point.attributes).filter(key => ![
                    'cratis.event_store.name', 'cratis.event_store.namespace', 'cratis.event_sequence.id', 'cratis.event_type.id'
                ].includes(key)).should.be.empty;
            }
        }
    });
});
