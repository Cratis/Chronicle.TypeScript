// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it } from 'vitest';
import type { ScopeMetrics } from '@opentelemetry/sdk-metrics';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';

chai.should();
const telemetry = telemetrySession();
describe('when recording metrics from thrown single and batch append failures', () => {
    let scopes: ScopeMetrics[];
    let scope: ScopeMetrics;
    let outcomes: PromiseSettledResult<unknown>[];
    const failure = new Error('Sensitive transport failure');
    beforeAll(async () => {
        const { sequence, services } = eventSequence();
        services.append.mockRejectedValue(failure);
        services.appendManyForEventSources.mockRejectedValue(failure);
        outcomes = await Promise.allSettled([
            sequence.append('private-source', new Recorded()),
            sequence.appendMany('private-source', [new Recorded(), new Recorded()])
        ]);
        scopes = (await telemetry.reader.collect()).resourceMetrics.scopeMetrics;
        scope = scopes[0];
    });
    it('should preserve both thrown failures', () => {
        outcomes.should.deep.equal([
            { status: 'rejected', reason: failure }, { status: 'rejected', reason: failure }
        ]);
    });
    it('should emit only the canonical error counter and no completed-append durations', () => {
        scopes.should.have.lengthOf(1);
        scope.scope.name.should.equal(names.scope);
        scope.metrics.map(metric => metric.descriptor.name).should.deep.equal([names.metrics.appendErrors]);
    });
    it('should count each failed operation once with only sequence dimensions', () => {
        const metric = scope.metrics[0];
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0].attributes.should.deep.equal({
            'cratis.event_store.name': 'store', 'cratis.event_store.namespace': 'namespace',
            'cratis.event_sequence.id': 'event-log'
        });
        metric.dataPoints[0].value.should.equal(2);
    });
});
