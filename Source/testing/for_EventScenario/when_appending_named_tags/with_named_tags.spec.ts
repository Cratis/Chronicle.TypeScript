// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { NamedTag } from '../../../events/NamedTag.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';
import { artifacts, Claim, createEvents, rejection } from '../given/routed_scenario.fixture.js';

chai.should();
const namedTags = [new NamedTag('batch', 'b-1')];

describe('when appending a single event with named tags in an event scenario', () => {
    let scenario: EventScenario;
    let error: UnsupportedEventSequenceOperation;
    beforeEach(async () => {
        scenario = createEvents();
        error = await rejection(() => scenario.append('source', new Claim('one'), { namedTags }));
    });
    it('should reject the named tags explicitly', () => error.message.should.contain('append.namedTags'));
    it('should not append the event', () => scenario.appendedEvents.should.have.lengthOf(0));
});

describe('when appending a batch with shared named tags in an event scenario', () => {
    let error: UnsupportedEventSequenceOperation;
    beforeEach(async () => {
        error = await rejection(() => createEvents().appendMany('source', [new Claim('one')], { namedTags }));
    });
    it('should reject the named tags explicitly', () => error.message.should.contain('appendMany.namedTags'));
});

describe('when appending a batch entry with named tags in an event scenario', () => {
    let error: UnsupportedEventSequenceOperation;
    beforeEach(async () => {
        error = await rejection(() => createEvents().appendMany([{ eventSourceId: 'source', event: new Claim('one'), namedTags }]));
    });
    it('should reject the named tags explicitly', () => error.message.should.contain('appendMany.namedTags'));
});

describe('when appending with an empty named tag list in an event scenario', () => {
    let scenario: EventScenario;
    beforeEach(async () => {
        scenario = new EventScenario({ artifacts });
        await scenario.append('source', new Claim('one'), { namedTags: [] });
    });
    it('should append the event', () => scenario.appendedEvents.should.have.lengthOf(1));
    it('should expose an empty named tag list on the stored context like a kernel delivery', () =>
        scenario.appendedEvents[0].context.namedTags!.should.deep.equal([]));
});
