// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { NamedTag } from '../../../events/index.js';
import { reducer } from '../../../reducers/reducer.js';
import { ReadModelScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { Claim, rejection } from '../../for_EventScenario/given/routed_scenario.fixture.js';

chai.should();
class Count { claimed = 0; }
class Counter { claim(_event: Claim, current: Count | undefined): Count { return { claimed: (current?.claimed ?? 0) + 1 }; } }
reducer('NamedTagSetupCounter', undefined, Count)(Counter);
const create = () => new ReadModelScenario(Count, { eventTypes: [Claim], reducers: [Counter], projections: [] });

describe('when read-model setup receives non-empty named tags', () => {
    let scenario: ReadModelScenario<Count>;
    let error: Error;
    beforeEach(async () => {
        scenario = create();
        error = await rejection(() => scenario.given.forEventSource('A', { namedTags: [new NamedTag('batch', 'b-1')] }).events(new Claim('Rejected')));
    });
    it('should reject with the typed unsupported operation error', () => error.should.be.instanceOf(UnsupportedEventSequenceOperation));
    it('should identify the append named tags operation', () => error.message.should.contain('UnsupportedEventSequenceOperation: append.namedTags (Claim)'));
    it('should not collect the rejected event', async () => ((await scenario.instance) === null).should.be.true);
});

describe('when read-model setup receives an empty named tag array', () => {
    let scenario: ReadModelScenario<Count>;
    beforeEach(() => {
        scenario = create();
        scenario.given.forEventSource('A', { namedTags: [] }).events(new Claim('Accepted'));
    });
    it('should accept and fold the event', async () => (await scenario.instance)!.claimed.should.equal(1));
});
