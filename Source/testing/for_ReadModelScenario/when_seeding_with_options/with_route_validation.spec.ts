// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import { reducer } from '../../../reducers/reducer.js';
import { ReadModelScenario, UnsupportedProjectionOperation } from '../../index.js';
import { Claim, createEvents, rejection, route } from '../../for_EventScenario/given/routed_scenario.fixture.js';

chai.should();
class Count { claimed = 0; }
class Counter { claim(_event: Claim, current: Count | undefined): Count { return { claimed: (current?.claimed ?? 0) + 1 }; } }
reducer('BuilderRouteCounter', undefined, Count)(Counter);
const create = () => new ReadModelScenario(Count, { eventTypes: [Claim], reducers: [Counter], projections: [] });

describe('when read-model setup receives route options', () => {
    it('should preserve default setup with omitted, explicit or empty defaults', async () => {
        const scenario = create();
        scenario.given.forEventSource('A').events(new Claim('First'));
        scenario.given.forEventSource('A', { sourceType: '', streamType: '', streamId: '' }).events(new Claim('Second'));
        scenario.given.forEventSource('A', { sourceType: 'Default', streamType: 'All', streamId: 'Default' }).events(new Claim('Third'));
        (await scenario.instance)!.claimed.should.equal(3);
    });

    it('should reuse single-append rejection messages without collecting unsupported input', async () => {
        const scenario = create();
        const events = createEvents();
        for (const value of [{ sourceType: ' ' }, { streamType: null }, { streamId: 1 }, null, []]) {
            const options = value as AppendOptions;
            const error = await rejection(() => events.append('A', new Claim('Other'), options));
            (await rejection(() => scenario.given.forEventSource('A', options).events(new Claim('Other')))).message.should.equal(error.message);
        }
        ((await scenario.instance) === null).should.be.true;
    });

    it('should list only supported seed options without collecting unsupported input', async () => {
        const scenario = create();
        for (const value of [{ tags: [] }, { arbitrary: true }, { subject: 'person-a' }]) {
            const options = value as AppendOptions;
            (await rejection(() => scenario.given.forEventSource('A', options).events(new Claim('Other')))).message.should.equal(
                'UnsupportedEventSequenceOperation: append.options (Claim): Only sourceType, streamType, streamId options are supported for single append. Use a kernel-backed test.');
        }
        ((await scenario.instance) === null).should.be.true;
    });

    it('should retain the unproven routed read-model boundary instead of simulating projection routing', async () => {
        const scenario = create();
        (() => scenario.given.forEventSource('A', route).events(new Claim('Other'))).should.throw(UnsupportedProjectionOperation, 'routed events');
        scenario.given.forEventSource('A').events(new Claim('Accepted'));
        (await scenario.instance)!.claimed.should.equal(1);
    });
});
