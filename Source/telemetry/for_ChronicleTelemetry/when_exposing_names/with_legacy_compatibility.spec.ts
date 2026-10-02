// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';
import { legacySpans, conventionSpans } from '../given/a_span_name_registry.fixture.js';

chai.should();
describe('when exposing names during the migration overlap', () => {
    it('should preserve every legacy span constant', () => {
        names.spans.should.deep.equal(legacySpans);
    });
    it('should expose a matching convention span for every operation', () => {
        names.conventionSpans.should.deep.equal(conventionSpans);
        Object.keys(names.conventionSpans).should.deep.equal(Object.keys(names.spans));
    });
    it('should preserve the current and historical scopes', () => {
        names.scope.should.equal('Cratis.Chronicle.Client');
        names.legacyScope.should.equal('@cratis/chronicle');
    });
    it('should preserve every legacy attribute constant', () => {
        names.legacyAttributes.should.deep.equal({
            eventStore: 'chronicle.event_store', namespace: 'chronicle.namespace',
            eventSequenceId: 'chronicle.event_sequence_id', sequenceNumber: 'chronicle.sequence_number',
            eventTypeId: 'chronicle.event_type_id', eventTypeGeneration: 'chronicle.event_type_generation',
            eventSourceId: 'chronicle.event_source_id', eventCount: 'chronicle.events_count',
            hasEvents: 'chronicle.has_events', eventStreamType: 'chronicle.event_stream_type', eventStreamId: 'chronicle.event_stream_id'
        });
    });
    it('should preserve every legacy metric constant', () => {
        names.legacyMetrics.should.deep.equal({
            eventsAppended: 'chronicle.events.appended', batchAppendsPerformed: 'chronicle.events.batch_appends',
            eventStoreRetrievals: 'chronicle.client.event_store_retrievals', appendDuration: 'chronicle.events.append_duration',
            appendManyDuration: 'chronicle.events.append_many_duration', constraintViolations: 'chronicle.events.constraint_violations',
            appendErrors: 'chronicle.events.append_errors'
        });
    });
    it('should expose the product-only attributes alongside the shared registry', () => {
        names.attributes.should.include({
            hasEvents: 'cratis.chronicle.event_sequence.has_events',
            eventStreamType: 'cratis.chronicle.event_stream.type', eventStreamId: 'cratis.chronicle.event_stream.id'
        });
    });
});
