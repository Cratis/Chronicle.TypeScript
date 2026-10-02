// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { Attributes } from '@opentelemetry/api';
import type { ChronicleClient } from '../../../ChronicleClient.js';
import { client } from '../given/a_client.fixture.js';
import { telemetrySession } from '../given/a_telemetry_session.fixture.js';

chai.should();
const telemetry = telemetrySession();

for (const spanNames of ['legacy', 'convention'] as const) {
    for (const hasEvents of [true, false]) {
        describe(`when recording event presence ${hasEvents} with ${spanNames} span names`, () => {
            let instance: ChronicleClient;
            let attributes: Attributes;
            beforeEach(async () => {
                instance = client({ spanNames });
                const store = await instance.getEventStore('store');
                telemetry.spans.reset();
                await store.eventLog.hasEventsFor(hasEvents ? 'source' : 'empty');
                attributes = telemetry.spans.getFinishedSpans()[0].attributes;
            });
            afterEach(() => instance.dispose());
            it('should record the boolean under both the legacy and product-only names', () => {
                attributes.should.include({
                    'chronicle.has_events': hasEvents,
                    'cratis.chronicle.event_sequence.has_events': hasEvents
                });
            });
        });
    }
    describe(`when completing a stream with ${spanNames} span names`, () => {
        let instance: ChronicleClient;
        let attributes: Attributes;
        beforeEach(async () => {
            instance = client({ spanNames });
            const store = await instance.getEventStore('store');
            telemetry.spans.reset();
            await store.eventLog.completeStream('orders', 'stream-1');
            attributes = telemetry.spans.getFinishedSpans()[0].attributes;
        });
        afterEach(() => instance.dispose());
        it('should record the stream type under both names', () => {
            attributes.should.include({ 'chronicle.event_stream_type': 'orders', 'cratis.chronicle.event_stream.type': 'orders' });
        });
        it('should record the stream identifier under both names', () => {
            attributes.should.include({ 'chronicle.event_stream_id': 'stream-1', 'cratis.chronicle.event_stream.id': 'stream-1' });
        });
    });
}
