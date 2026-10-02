// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { eventSourceType } from '../../../events/eventSourceTypeDecorator.js';
import { eventStreamType } from '../../../events/eventStreamTypeDecorator.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { EventContext } from '../../../events/EventContext.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import { dispatchReactorSideEffects } from '../../ReactorSideEffects.js';

chai.should();
@eventType('side-effect-with-reactor-types')
class Outbound {}
@eventSourceType('my-source')
class SourceReactor {}
@eventStreamType('my-stream')
class StreamReactor extends SourceReactor {}
class InheritedReactor extends StreamReactor {}
@eventSourceType('')
@eventStreamType('')
class EmptyReactor extends StreamReactor {}
@eventStreamType('All')
class AllStreamsReactor {}
const context = { eventSourceId: 'trigger', eventStreamType: 'trigger-stream', eventStreamId: 'trigger-stream-id' } as EventContext;

for (const [reactorType, sourceType, streamType] of [
    [SourceReactor, 'my-source', 'trigger-stream'],
    [StreamReactor, 'my-source', 'my-stream'],
    [InheritedReactor, 'my-source', 'my-stream'],
    [EmptyReactor, undefined, 'trigger-stream'],
    [AllStreamsReactor, undefined, 'All']
] as const) {
    describe(`when dispatching a bare returned event from ${reactorType.name}`, () => {
        let appended: EventForEventSourceId[];
        const outbound = new Outbound();
        beforeEach(async () => {
            const eventLog = { appendMany: vi.fn(async (events: EventForEventSourceId[]) => {
                appended = events;
                return [{ isSuccess: true, errors: [], constraintViolations: [] }];
            }) } as unknown as IEventLog;
            await dispatchReactorSideEffects(eventLog, outbound, context, reactorType, 'store', 'namespace');
        });
        it('should append the returned event with the reactor types and triggering target', () => {
            appended.should.deep.equal([{ eventSourceId: 'trigger', event: outbound, eventStreamType: streamType,
                ...(sourceType ? { eventSourceType: sourceType } : {}), eventStreamId: 'trigger-stream-id', subject: 'trigger' }]);
        });
    });
}

describe('when dispatching mixed bare and explicitly targeted returned events', () => {
    let appended: EventForEventSourceId[];
    const explicit = { eventSourceId: 'other', event: new Outbound(), eventSourceType: 'explicit-source',
        eventStreamType: 'explicit-stream', eventStreamId: 'other-stream', subject: 'other-subject' };
    const omitted = { eventSourceId: 'omitted', event: new Outbound() };
    const empty = { eventSourceId: 'empty', event: new Outbound(), eventSourceType: '', eventStreamType: '' };
    beforeEach(async () => {
        const eventLog = { appendMany: vi.fn(async (events: EventForEventSourceId[]) => {
            appended = events;
            return [{ isSuccess: true, errors: [], constraintViolations: [] }];
        }) } as unknown as IEventLog;
        await dispatchReactorSideEffects(eventLog, [new Outbound(), explicit, omitted, empty], context, StreamReactor, 'store', 'namespace');
    });
    it('should apply reactor metadata to only the bare event', () => {
        appended[0].eventSourceType!.should.equal('my-source');
        appended[0].eventStreamType!.should.equal('my-stream');
    });
    it('should preserve explicit targets including omitted and empty type values', () => {
        appended.slice(1).should.deep.equal([explicit, omitted, empty]);
        appended[1].should.equal(explicit);
        appended[2].should.equal(omitted);
        appended[3].should.equal(empty);
    });
});
