// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { a_sequence, append_events, AppendMode, EnrichedEvent, modes } from './given.fixture.js';

chai.should();

for (const mode of modes) {
    for (const asynchronous of [false, true]) {
        describe(`when a provider ${asynchronous ? 'rejects' : 'throws'} during ${AppendMode[mode]}`, () => {
            let calls: ReturnType<typeof a_sequence>['calls'];
            let result: PromiseSettledResult<unknown>;
            let failure: Error;
            let later: ReturnType<typeof vi.fn>;
            beforeEach(async () => {
                failure = new Error('enrichment failed');
                later = vi.fn();
                const fixture = a_sequence([
                    content => { content.enriched = true; },
                    () => { if (asynchronous) return Promise.reject(failure); throw failure; },
                    later
                ]);
                calls = fixture.calls;
                [result] = await Promise.allSettled([append_events(fixture.sequence, mode)]);
            });
            it('should surface the original provider failure', () => {
                result.status.should.equal('rejected');
                if (result.status === 'rejected') result.reason.should.equal(failure);
            });
            it('should transmit nothing', () => calls.flatMap(call => call.mock.calls).should.have.lengthOf(0));
            it('should not invoke later providers', () => later.mock.calls.should.have.lengthOf(0));
        });
    }
}

describe('when enrichment rejects on a later batch event', () => {
    let calls: ReturnType<typeof a_sequence>['calls'];
    let visited: string[];
    let result: PromiseSettledResult<unknown>;
    beforeEach(async () => {
        visited = [];
        const fixture = a_sequence([async content => {
            visited.push(String(content.value));
            await Promise.resolve();
            if (content.value === 'two') throw new Error('second event failed');
            content.enriched = true;
        }]);
        calls = fixture.calls;
        [result] = await Promise.allSettled([append_events(fixture.sequence, AppendMode.batch, [
            new EnrichedEvent('one'), new EnrichedEvent('two'), new EnrichedEvent('three')
        ])]);
    });
    it('should have enriched the first event before the failure', () => visited.should.deep.equal(['one', 'two']));
    it('should reject the entire append', () => result.status.should.equal('rejected'));
    it('should not transmit even the successfully enriched event', () => calls.flatMap(call => call.mock.calls).should.have.lengthOf(0));
});
