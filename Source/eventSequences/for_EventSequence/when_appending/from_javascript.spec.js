// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequence, EventSequenceId, eventType } from '../../../index.js';

chai.should();

describe('when appending from the JavaScript public API', () => {
    let requests;
    beforeEach(async () => {
        class JavascriptEventRecorded { value = 'plain JavaScript'; }
        eventType('JavascriptEventRecorded')(JavascriptEventRecorded);
        requests = [];
        const connection = { eventSequences: {
            append: async request => { requests.push(request); return { Response: { SequenceNumber: 0n } }; },
            appendManyForEventSources: async request => { requests.push(request); return { Response: { SequenceNumbers: [1n] } }; }
        } };
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'tenant', connection, {});
        await sequence.append('source', new JavascriptEventRecorded(), { streamType: 'Default', streamId: 'source' });
        await sequence.appendMany([{ eventSourceId: 'other', event: new JavascriptEventRecorded(), eventStreamType: 'Explicit' }], { sourceType: 'Shared' });
    });
    it('should accept options and rich plain-object entries without TypeScript-only helpers', () => {
        requests.should.have.lengthOf(2);
        requests[0].EventStreamType.should.equal('Default');
        requests[0].EventStreamId.should.equal('source');
        requests[1].Events[0].EventStreamType.should.equal('Explicit');
        requests[1].Events[0].EventSourceType.should.equal('Shared');
        JSON.parse(requests[0].Content).should.deep.equal({ value: 'plain JavaScript' });
    });
});
