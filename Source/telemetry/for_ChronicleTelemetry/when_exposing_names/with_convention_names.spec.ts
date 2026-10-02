// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { WellKnownTelemetryNames as names } from '../../../WellKnownTelemetryNames.js';
import { conventionSpans } from '../given/a_span_name_registry.fixture.js';

chai.should();
describe('when exposing convention-only telemetry names', () => {
    it('should expose convention spans through the single spans registry', () => {
        names.spans.should.deep.equal(conventionSpans);
        names.should.not.have.property('conventionSpans');
    });
    it('should expose only the current scope and registries', () => {
        names.scope.should.equal('Cratis.Chronicle.Client');
        names.should.not.have.property('legacyScope');
        names.should.not.have.property('legacyAttributes');
        names.should.not.have.property('legacyMetrics');
    });
    it('should retain the product-only attributes alongside the shared registry', () => {
        names.attributes.should.include({
            hasEvents: 'cratis.chronicle.event_sequence.has_events',
            eventStreamType: 'cratis.chronicle.event_stream.type', eventStreamId: 'cratis.chronicle.event_stream.id'
        });
    });
});
