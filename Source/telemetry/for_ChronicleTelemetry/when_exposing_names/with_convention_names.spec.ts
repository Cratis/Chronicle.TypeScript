// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, expectTypeOf, it } from 'vitest';
import { ChronicleOptions, ChronicleMetrics, ChronicleConventionMetrics, WellKnownTelemetryNames as names } from '../../../index.js';
import type { ChronicleTelemetryOptions } from '../../../index.js';
import { legacySpans, conventionSpans } from '../given/a_span_name_registry.fixture.js';

const legacyAttributes = {
    eventStore: 'chronicle.event_store', namespace: 'chronicle.namespace',
    eventSequenceId: 'chronicle.event_sequence_id', sequenceNumber: 'chronicle.sequence_number',
    eventTypeId: 'chronicle.event_type_id', eventTypeGeneration: 'chronicle.event_type_generation',
    eventSourceId: 'chronicle.event_source_id', eventCount: 'chronicle.events_count',
    hasEvents: 'chronicle.has_events', eventStreamType: 'chronicle.event_stream_type', eventStreamId: 'chronicle.event_stream_id'
} as const;
const legacyMetrics = {
    eventsAppended: 'chronicle.events.appended', batchAppendsPerformed: 'chronicle.events.batch_appends',
    eventStoreRetrievals: 'chronicle.client.event_store_retrievals', appendDuration: 'chronicle.events.append_duration',
    appendManyDuration: 'chronicle.events.append_many_duration', constraintViolations: 'chronicle.events.constraint_violations',
    appendErrors: 'chronicle.events.append_errors'
} as const;

chai.should();
describe('when exposing canonical names alongside retained compatibility APIs', () => {
    it('should preserve every legacy span value and literal type', () => {
        names.spans.should.deep.equal(legacySpans);
        expectTypeOf(names.spans).toEqualTypeOf<typeof legacySpans>();
    });
    it('should expose a matching canonical span for every operation', () => {
        names.conventionSpans.should.deep.equal(conventionSpans);
        expectTypeOf(names.conventionSpans).toEqualTypeOf<typeof conventionSpans>();
        Object.keys(names.conventionSpans).should.deep.equal(Object.keys(names.spans));
    });
    it('should preserve the current and historical scopes', () => {
        names.scope.should.equal('Cratis.Chronicle.Client');
        names.legacyScope.should.equal('@cratis/chronicle');
        expectTypeOf(names.legacyScope).toEqualTypeOf<'@cratis/chronicle'>();
    });
    it('should preserve every legacy attribute value and literal type', () => {
        names.legacyAttributes.should.deep.equal(legacyAttributes);
        expectTypeOf(names.legacyAttributes).toEqualTypeOf<typeof legacyAttributes>();
    });
    it('should preserve every legacy metric value and literal type', () => {
        names.legacyMetrics.should.deep.equal(legacyMetrics);
        expectTypeOf(names.legacyMetrics).toEqualTypeOf<typeof legacyMetrics>();
    });
    it('should retain both typed selector values through the public factories', () => {
        expectTypeOf<ChronicleTelemetryOptions['spanNames']>().toEqualTypeOf<'legacy' | 'convention' | undefined>();
        for (const spanNames of ['legacy', 'convention'] as const) {
            ChronicleOptions.development({ telemetry: { spanNames } }).telemetry!.spanNames!.should.equal(spanNames);
            ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { telemetry: { spanNames } })
                .telemetry!.spanNames!.should.equal(spanNames);
        }
    });
    it('should retain the public metric recording signatures', () => {
        expectTypeOf(ChronicleMetrics).toEqualTypeOf<typeof ChronicleConventionMetrics>();
        Object.keys(ChronicleMetrics).should.have.members(Object.keys(names.legacyMetrics));
    });
    it('should retain the product-only attributes alongside the shared registry', () => {
        names.attributes.should.include({
            hasEvents: 'cratis.chronicle.event_sequence.has_events',
            eventStreamType: 'cratis.chronicle.event_stream.type', eventStreamId: 'cratis.chronicle.event_stream.id'
        });
    });
});
