// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { filterEventsByTag, reducer, tag } from '../../../index.js';
import { ReadModelScenario, UnsupportedReducerOperation } from '../../index.js';

chai.should();
class State { count = 0; }
let created = false;
@reducer('tag-filtered-scenario', undefined, State)
@filterEventsByTag('vip')
class TagFiltered {
    constructor() { created = true; }
}
class InheritedTagFiltered extends TagFiltered {}
@reducer('label-only-scenario', undefined, State)
@tag('vip')
class Labeled {}
@reducer('empty-tag-filter-scenario', undefined, State)
@filterEventsByTag('')
class EmptyFilter {}

for (const type of [TagFiltered, InheritedTagFiltered]) {
    describe(`when creating a reducer scenario for ${type.name}`, () => {
        it('should reject tag-filtered delivery before activating the reducer', () => {
            created = false;
            try {
                new ReadModelScenario(State, { reducers: [type], eventTypes: [], projections: [] });
                throw new Error('Expected unsupported reducer operation');
            } catch (error) {
                (error instanceof UnsupportedReducerOperation).should.be.true;
                const unsupported = error as UnsupportedReducerOperation;
                unsupported.operation.should.equal('reducer.filterEventsByTag');
                unsupported.artifact.should.equal(type.name);
                unsupported.message.should.contain('Tag-filtered delivery is not fixture-backed.');
                unsupported.message.should.contain('Use a kernel-backed test.');
            }
            created.should.be.false;
        });
    });
}

for (const type of [Labeled, EmptyFilter]) {
    describe(`when creating a reducer scenario for ${type.name}`, () => {
        it('should allow metadata that does not restrict delivery', () => {
            (() => new ReadModelScenario(State, { reducers: [type], eventTypes: [], projections: [] })).should.not.throw();
        });
    });
}
