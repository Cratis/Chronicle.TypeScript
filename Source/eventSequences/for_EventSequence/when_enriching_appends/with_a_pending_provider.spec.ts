// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_sequence, append_events, AppendMode, EnrichedEvent, modes, transmitted } from './given.fixture.js';

chai.should();

for (const mode of modes) {
    describe(`when a provider is pending during ${AppendMode[mode]}`, () => {
        let calls: ReturnType<typeof a_sequence>['calls'];
        let pending: Promise<unknown>;
        let release: () => void;
        let order: string[];
        beforeEach(async () => {
            order = [];
            let started!: () => void;
            const entered = new Promise<void>(resolve => { started = resolve; });
            const gate = new Promise<void>(resolve => { release = resolve; });
            const fixture = a_sequence([
                async content => { started(); await gate; content.ready = true; order.push('first'); },
                () => { order.push('second'); }
            ]);
            calls = fixture.calls;
            pending = append_events(fixture.sequence, mode);
            await entered;
        });
        it('should not send a request or invoke the next provider until completion', async () => {
            try {
                calls.flatMap(call => call.mock.calls).should.have.lengthOf(0);
                order.should.have.lengthOf(0);
            } finally { release(); await pending; }
        });
        it('should send enriched content only after completion', async () => {
            release();
            await pending;
            transmitted(calls).contents[0].ready.should.equal(true);
        });
    });
}

describe('when enriching multiple batch events', () => {
    let calls: ReturnType<typeof a_sequence>['calls'];
    let order: string[];
    beforeEach(async () => {
        order = [];
        const fixture = a_sequence([
            async content => { await Promise.resolve(); order.push(`first ${content.value}`); content.enriched = true; },
            content => { order.push(`second ${content.value}`); }
        ]);
        calls = fixture.calls;
        await append_events(fixture.sequence, AppendMode.batch, [new EnrichedEvent('one'), new EnrichedEvent('two')]);
    });
    it('should run every provider in order for each event in input order', () => order.should.deep.equal([
        'first one', 'second one', 'first two', 'second two'
    ]));
    it('should send all enriched events together', () => transmitted(calls).contents.map(content => content.enriched).should.deep.equal([true, true]));
});
