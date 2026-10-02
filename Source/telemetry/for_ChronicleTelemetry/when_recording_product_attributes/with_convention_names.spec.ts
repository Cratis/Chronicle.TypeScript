// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { Attributes } from '@opentelemetry/api';
import type { ChronicleClient } from '../../../ChronicleClient.js';
import { client } from '../given/a_client.fixture.js';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';

chai.should();
const telemetry = telemetrySession();

for (const hasEvents of [true, false]) {
    describe(`when recording event presence ${hasEvents}`, () => {
        let instance: ChronicleClient;
        let attributes: Attributes;
        beforeEach(async () => {
            instance = client();
            const store = await instance.getEventStore('store');
            telemetry.spans.reset();
            await store.eventLog.hasEventsFor(hasEvents ? 'source' : 'empty');
            attributes = telemetry.spans.getFinishedSpans()[0].attributes;
        });
        afterEach(() => instance.dispose());
        it('should record the boolean under only the product name', () => {
            attributes.should.have.property('cratis.chronicle.event_sequence.has_events', hasEvents);
            attributes.should.not.have.property('chronicle.has_events');
        });
    });
}

describe('when completing a stream', () => {
    let instance: ChronicleClient;
    let attributes: Attributes;
    beforeEach(async () => {
        instance = client();
        const store = await instance.getEventStore('store');
        telemetry.spans.reset();
        await store.eventLog.completeStream('orders', 'stream-1');
        attributes = telemetry.spans.getFinishedSpans()[0].attributes;
    });
    afterEach(() => instance.dispose());
    it('should record the stream type under only the product name', () => {
        attributes.should.have.property('cratis.chronicle.event_stream.type', 'orders');
        attributes.should.not.have.property('chronicle.event_stream_type');
    });
    it('should record the stream identifier under only the product name', () => {
        attributes.should.have.property('cratis.chronicle.event_stream.id', 'stream-1');
        attributes.should.not.have.property('chronicle.event_stream_id');
    });
});
