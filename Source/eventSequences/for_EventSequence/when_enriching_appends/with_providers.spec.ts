// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId, type EventEnrichmentContext, type EventEnrichmentProvider } from '../../index.js';
import { a_sequence, append_events, AppendMode, correlationId, EnrichedEvent, modes, transmitted } from './given.fixture.js';

chai.should();

for (const mode of modes) {
    describe(`when enriching ${AppendMode[mode]} after serialization`, () => {
        let calls: ReturnType<typeof a_sequence>['calls'];
        let event: EnrichedEvent;
        let contexts: EventEnrichmentContext[];
        let observed: Record<string, unknown>[];
        let order: string[];
        beforeEach(async () => {
            event = new EnrichedEvent();
            contexts = [];
            observed = [];
            order = [];
            const first: EventEnrichmentProvider = async (content, context) => {
                observed.push(structuredClone(content));
                contexts.push(context);
                order.push('first started');
                await Promise.resolve();
                content.added = 'from first';
                (content.nested as Record<string, unknown>).value = 'changed';
                delete content.removable;
                order.push('first finished');
            };
            const second: EventEnrichmentProvider = content => {
                order.push('second');
                content.value = content.added;
            };
            const fixture = a_sequence([first, second]);
            calls = fixture.calls;
            await append_events(fixture.sequence, mode, [event]);
        });
        it('should await providers in configured order', () => order.should.deep.equal(['first started', 'first finished', 'second']));
        it('should provide the serialized object rather than the event instance', () => observed.should.deep.equal([
            { value: 'original', nested: { value: 'original' }, recordedAt: '2026-01-01T00:00:00.000Z', removable: true }
        ]));
        it('should transmit additions replacements deletions and nested mutations', () => transmitted(calls).contents.should.deep.equal([
            { value: 'from first', nested: { value: 'changed' }, recordedAt: '2026-01-01T00:00:00.000Z', added: 'from first' }
        ]));
        it('should leave the original event unchanged', () => event.should.deep.equal(new EnrichedEvent()));
        it('should provide event and append context without a wire request', () => {
            const context = contexts[0];
            context.event.should.equal(event);
            context.eventType.id.value.should.equal('enrichment-event');
            context.eventStore.should.equal('store');
            context.namespace.should.equal('tenant');
            context.eventSequenceId.should.equal(EventSequenceId.eventLog);
            context.eventSourceId.should.equal('source');
            context.correlationId.toString().should.equal(correlationId);
        });
        it('should preserve append metadata', () => {
            const { events } = transmitted(calls);
            events[0].Tags.should.deep.equal(['kept']);
            events[0].EventSourceId.should.equal('source');
            events[0].EventType.Id.should.equal('enrichment-event');
            events[0].EventStreamId.should.equal('stream');
        });
    });
}
