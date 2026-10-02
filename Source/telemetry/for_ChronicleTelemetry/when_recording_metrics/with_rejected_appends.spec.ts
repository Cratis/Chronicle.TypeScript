// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it, vi } from 'vitest';
import { ConstraintType } from '@cratis/chronicle.contracts';
import type { ScopeMetrics } from '@opentelemetry/sdk-metrics';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';

chai.should();
const telemetry = telemetrySession();
describe('when recording metrics from rejected single and batch appends', () => {
    let scopes: ScopeMetrics[];
    let scope: ScopeMetrics;
    const sequenceAttributes = {
        'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
        'cratis.event_sequence.id': 'event-log'
    };
    const eventAttributes = { ...sequenceAttributes, 'cratis.event_type.id': 'telemetry-recorded' };

    beforeAll(async () => {
        const { sequence, services } = eventSequence();
        const rejection = {
            ConstraintViolations: [{
                EventTypeId: 'telemetry-recorded', SequenceNumber: 0n, ConstraintType: ConstraintType.Unique,
                ConstraintName: 'unique', Message: 'Value must be unique', Details: {}
            }],
            Errors: ['Append rejected']
        };
        let milliseconds = 1000;
        const clock = vi.spyOn(performance, 'now').mockImplementation(() => milliseconds);
        services.append.mockImplementation(async () => {
            milliseconds += 500;
            return { Response: { SequenceNumber: 0n, ...rejection } };
        });
        services.appendManyForEventSources.mockImplementation(async () => {
            milliseconds += 2500;
            return { Response: { SequenceNumbers: [], ...rejection } };
        });
        try {
            await sequence.append('private-source', new Recorded());
            await sequence.appendMany('private-source', [new Recorded(), new Recorded()]);
            scopes = (await telemetry.reader.collect()).resourceMetrics.scopeMetrics;
            scope = scopes[0];
        } finally {
            clock.mockRestore();
        }
    });

    it('should emit only canonical append instruments', () => {
        scopes.should.have.lengthOf(1);
        scope.scope.name.should.equal(names.scope);
        scope.metrics.map(metric => metric.descriptor.name).should.have.members([
            names.metrics.eventsAppended, names.metrics.batchAppendsPerformed, names.metrics.appendDuration,
            names.metrics.appendManyDuration, names.metrics.constraintViolations, names.metrics.appendErrors
        ]);
    });
    it('should record completed rejection durations in seconds without scaling twice', () => {
        for (const [instrument, seconds, attributes] of [
            ['appendDuration', 0.5, eventAttributes], ['appendManyDuration', 2.5, sequenceAttributes]
        ] as const) {
            const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            metric.descriptor.unit.should.equal('s');
            metric.dataPoints.should.have.lengthOf(1);
            metric.dataPoints[0].attributes.should.deep.equal(attributes);
            metric.dataPoints[0].value.should.include({ min: seconds, max: seconds, sum: seconds, count: 1 });
        }
    });
    it('should retain per-result violation and error counts with only sequence dimensions', () => {
        for (const instrument of ['constraintViolations', 'appendErrors'] as const) {
            const metric = scope.metrics.find(metric => metric.descriptor.name === names.metrics[instrument])!;
            metric.dataPoints.should.have.lengthOf(1);
            metric.dataPoints[0].attributes.should.deep.equal(sequenceAttributes);
            metric.dataPoints[0].value.should.equal(3);
        }
    });
    it('should retain completed-append counter semantics for returned rejections', () => {
        const appended = scope.metrics.find(metric => metric.descriptor.name === names.metrics.eventsAppended)!;
        appended.dataPoints.map(point => ({ attributes: point.attributes, value: point.value })).should.have.deep.members([
            { attributes: eventAttributes, value: 1 }, { attributes: sequenceAttributes, value: 2 }
        ]);
        const batches = scope.metrics.find(metric => metric.descriptor.name === names.metrics.batchAppendsPerformed)!;
        batches.dataPoints.should.have.lengthOf(1);
        batches.dataPoints[0].attributes.should.deep.equal(sequenceAttributes);
        batches.dataPoints[0].value.should.equal(1);
    });
});
