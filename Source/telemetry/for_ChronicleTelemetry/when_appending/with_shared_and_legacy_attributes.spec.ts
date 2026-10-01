// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { SpanKind, context, propagation } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';
import { clientVersion } from '../../../connection/clientVersion.js';
import { CorrelationId, correlationIdManager } from '../../../correlation/index.js';

const should = chai.should();
const telemetry = telemetrySession();
const correlation = '95bd1c83-de97-45f7-84a0-fb462af14d0c';

describe('when appending with a business correlation override', () => {
    let span: ReadableSpan;
    let injectedCorrelation: string | undefined;
    beforeEach(async () => {
        const { sequence, services } = eventSequence();
        services.append.mockImplementation(async () => {
            await Promise.resolve();
            injectedCorrelation = propagation.getBaggage(context.active())?.getEntry('cratis.correlation_id')?.value;
            return { Response: { SequenceNumber: 42n } };
        });
        await correlationIdManager.run(new CorrelationId('outer'), () => sequence.append('sensitive-id', new Recorded(), { correlationId: correlation }));
        span = telemetry.spans.getFinishedSpans()[0];
    });
    it('should produce one client span with the unchanged operation name', () => {
        telemetry.spans.getFinishedSpans().should.have.lengthOf(1);
        span.kind.should.equal(SpanKind.CLIENT);
        span.name.should.equal('chronicle.event_sequences.append');
    });
    it('should use the versioned shared instrumentation scope', () => {
        span.instrumentationScope.name.should.equal('Cratis.Chronicle.Client');
        should.equal(span.instrumentationScope.version, clientVersion);
    });
    it('should emit both registries on the same span', () => {
        span.attributes.should.include({
            'cratis.event_store.name': 'store', 'chronicle.event_store': 'store',
            'cratis.event_store.namespace': 'namespace', 'chronicle.namespace': 'namespace',
            'cratis.event_sequence.id': 'event-log', 'chronicle.event_sequence_id': 'event-log',
            'cratis.event_type.id': 'telemetry-recorded', 'chronicle.event_type_id': 'telemetry-recorded',
            'cratis.event_type.generation': 1, 'chronicle.event_type_generation': 1,
            'cratis.event_sequence.number': 42, 'chronicle.sequence_number': '42'
        });
    });
    it('should scope the resolved correlation consistently for propagation', () => {
        should.equal(span.attributes['cratis.correlation_id'], correlation);
        should.equal(injectedCorrelation, correlation);
        should.equal(correlationIdManager.scoped, undefined);
    });
    it('should not record identifiers or payloads by default', () => {
        JSON.stringify(span.attributes).should.not.contain('sensitive');
        should.equal(span.attributes['cratis.event_source.id'], undefined);
        should.equal(span.attributes['chronicle.event_source_id'], undefined);
    });
});
