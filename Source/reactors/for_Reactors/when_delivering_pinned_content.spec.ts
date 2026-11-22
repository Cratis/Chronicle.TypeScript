// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AppendedEvent } from '@cratis/chronicle.contracts';
import { eventType, type EventContext } from '../../events/index.js';
import { EventBatch, EventGenerationDelivery, observes } from '../../observation/index.js';
import { reducer } from '../../reducers/reducer.js';
import { observeReducerMessages, page as reducerPage } from '../../reducers/for_Reducers/given/observe_reducer_messages.js';
import { reactor } from '../reactor.js';
import { observeReactorMessages, page } from './given/observe_reactor_messages.js';

chai.should();

@eventType('pinned-content-item', 1)
class LegacyItem { legacyValue = ''; }

for (const style of ['per-event', 'batch'] as const) {
    describe(`when delivering pinned content to ${style} reactor and reducer handlers`, () => {
        let seen: { content: LegacyItem; context: EventContext }[];
        beforeEach(async () => {
            seen = [];
            const capture = (content: LegacyItem, context: EventContext) => { seen.push({ content, context }); };
            @reactor('pinned-content', undefined, EventGenerationDelivery.Pinned)
            class PerEventReactor { legacyItem(content: LegacyItem, context: EventContext) { capture(content, context); } }
            @reactor('pinned-content-batch', undefined, EventGenerationDelivery.Pinned)
            class BatchReactor {
                @observes(LegacyItem)
                handle(events: EventBatch) { for (const entry of events.events) capture(entry.event as LegacyItem, entry.context); }
            }
            @reducer('pinned-content', undefined, undefined, true, EventGenerationDelivery.Pinned)
            class PerEventReducer {
                legacyItem(content: LegacyItem, _state: unknown, context: EventContext) { capture(content, context); return {}; }
            }
            @reducer('pinned-content-batch', undefined, undefined, true, EventGenerationDelivery.Pinned)
            class BatchReducer {
                @observes(LegacyItem)
                handle(events: EventBatch) {
                    for (const entry of events.events) capture(entry.event as LegacyItem, entry.context);
                    return {};
                }
            }
            const event = AppendedEvent.fromPartial({
                Context: { EventType: { Id: 'pinned-content-item', Generation: 1 }, AppendedGeneration: 2, SequenceNumber: 1n, EventSourceId: 'source' },
                Content: JSON.stringify({ legacyValue: 'released generation one' }),
                GenerationalContent: { 2: JSON.stringify({ latestValue: 'generation two' }) }
            });
            await observeReactorMessages(style === 'batch' ? BatchReactor : PerEventReactor, [LegacyItem], [page(1n, { source: [event] })]);
            await observeReducerMessages(style === 'batch' ? BatchReducer : PerEventReducer, [LegacyItem], [reducerPage(1n, { source: { events: [event] } })]);
        });
        it('should deliver released Content and retain the distinct appended generation through both pipelines', () => {
            seen.length.should.equal(2);
            for (const delivery of seen) {
                delivery.content.should.deep.equal({ legacyValue: 'released generation one' });
                delivery.content.legacyValue.should.equal('released generation one');
                Object.hasOwn(delivery.content, 'latestValue').should.be.false;
                delivery.context.eventType.generation.value.should.equal(1);
                delivery.context.appendedGeneration!.value.should.equal(2);
            }
        });
    });
}
