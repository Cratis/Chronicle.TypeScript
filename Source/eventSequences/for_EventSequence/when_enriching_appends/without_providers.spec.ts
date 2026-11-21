// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { JsonSerializer } from '@cratis/fundamentals';
import { a_sequence, append_events, AppendMode, EnrichedEvent, modes, transmitted } from './given.fixture.js';

chai.should();

for (const mode of modes) {
    describe(`when appending ${AppendMode[mode]} without enrichment providers`, () => {
        let calls: ReturnType<typeof a_sequence>['calls'];
        let event: EnrichedEvent;
        beforeEach(async () => {
            event = new EnrichedEvent();
            const fixture = a_sequence();
            calls = fixture.calls;
            await append_events(fixture.sequence, mode, [event]);
        });
        it('should preserve serialized content unchanged', () => {
            transmitted(calls).contents.should.deep.equal([JSON.parse(JsonSerializer.serialize(event))]);
        });
        it('should transmit exactly one request', () => calls.flatMap(call => call.mock.calls).should.have.lengthOf(1));
    });
}
