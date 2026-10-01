// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHmac } from 'node:crypto';
import { beforeEach, chai, describe, it } from 'vitest';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';
import { eventSequence, Recorded } from '../given/an_event_sequence.fixture.js';
import { EventSequenceNumber } from '../../../eventSequences/EventSequenceNumber.js';
import type { ChronicleTelemetryOptions } from '../../ChronicleTelemetryOptions.js';

const should = chai.should();
const telemetry = telemetrySession();
const source = 'sensitive-source';
const key = new Uint8Array([10, 20, 30, 40]);

for (const [label, policy, expected] of [
    ['absent', undefined, undefined],
    ['raw', { eventSourceId: { mode: 'raw' } }, source],
    ['hmac', { eventSourceId: { mode: 'hmac', key } }, createHmac('sha256', key).update(source).digest('hex')]
] as const) {
    describe(`when recording event source identifiers with ${label} privacy`, () => {
        beforeEach(async () => {
            const { sequence, services } = eventSequence(policy as ChronicleTelemetryOptions | undefined);
            await sequence.append(source, new Recorded());
            await sequence.appendMany(source, [new Recorded(), new Recorded()]);
            await sequence.appendMany([{ eventSourceId: source, event: new Recorded() }, { eventSourceId: source, event: new Recorded() }]);
            await sequence.getTailSequenceNumber(source);
            await sequence.hasEventsFor(source);
            await sequence.getForEventSourceIdAndEventTypes(source, [Recorded]);
            await sequence.getFromSequenceNumber(new EventSequenceNumber(1n), source);
            await sequence.redactForEventSource(source, 'private reason');
            services.append.mock.calls[0][0].EventSourceId.should.equal(source);
        });
        it('should apply the policy equally to both names on every operation', () => {
            telemetry.spans.getFinishedSpans().should.have.lengthOf(8);
            for (const span of telemetry.spans.getFinishedSpans()) {
                should.equal(span.attributes['cratis.event_source.id'], expected);
                should.equal(span.attributes['chronicle.event_source_id'], expected);
            }
        });
    });
}

describe('when appending a batch with multiple event sources', () => {
    beforeEach(async () => {
        await eventSequence({ eventSourceId: { mode: 'raw' } }).sequence.appendMany([
            { eventSourceId: 'first', event: new Recorded() }, { eventSourceId: 'second', event: new Recorded() }
        ]);
    });
    it('should record the count without an identifier array', () => {
        const attributes = telemetry.spans.getFinishedSpans()[0].attributes;
        attributes.should.include({ 'cratis.event.count': 2, 'chronicle.events_count': 2 });
        should.equal(attributes['cratis.event_source.id'], undefined);
        should.equal(attributes['chronicle.event_source_id'], undefined);
    });
});

describe('when clients use different identifier policies concurrently', () => {
    beforeEach(async () => {
        await Promise.all([
            eventSequence().sequence.append(source, new Recorded()),
            eventSequence({ eventSourceId: { mode: 'raw' } }).sequence.append(source, new Recorded()),
            eventSequence({ eventSourceId: { mode: 'hmac', key } }).sequence.append(source, new Recorded())
        ]);
    });
    it('should keep each policy local to its client', () => {
        const identifiers = telemetry.spans.getFinishedSpans().map(span => span.attributes['cratis.event_source.id']);
        identifiers.should.have.members([undefined, source, createHmac('sha256', key).update(source).digest('hex')]);
    });
});
