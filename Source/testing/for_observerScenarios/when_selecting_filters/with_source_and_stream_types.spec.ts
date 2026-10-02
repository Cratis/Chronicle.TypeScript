// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventSourceType, eventStreamType, reactor, reducer } from '../../../index.js';
import { ReactorScenario, ReadModelScenario, UnsupportedReactorOperation, UnsupportedReducerOperation } from '../../index.js';

chai.should();
function should(value: unknown): ReturnType<typeof chai.expect> {
    return (value as { should: ReturnType<typeof chai.expect> }).should;
}

class State { count = 0; }
@reactor('source-filtered-scenario')
@reducer('source-filtered-scenario', undefined, State)
@eventSourceType('Customers')
class SourceFiltered {}
@reactor('stream-filtered-scenario')
@reducer('stream-filtered-scenario', undefined, State)
@eventStreamType('Orders')
class StreamFiltered {}
@reactor('default-filtered-scenario')
@reducer('default-filtered-scenario', undefined, State)
@eventSourceType('')
@eventStreamType('All')
class DefaultFiltered {}
class InheritedSourceFiltered extends SourceFiltered {}

for (const type of [SourceFiltered, StreamFiltered, InheritedSourceFiltered]) {
    describe(`when creating observer scenarios for ${type.name}`, () => {
        it('should reject unproven reactor filter semantics before delivering events', () => {
            should(() => new ReactorScenario(type)).throw(UnsupportedReactorOperation, 'Use a kernel-backed test.');
        });
        it('should reject unproven reducer filter semantics before folding events', () => {
            should(() => new ReadModelScenario(State, { reducers: [type], eventTypes: [], projections: [] }))
                .throw(UnsupportedReducerOperation, 'Use a kernel-backed test.');
        });
    });
}

describe('when creating observer scenarios with explicit default filters', () => {
    it('should allow the existing unrestricted reactor scenario', () => {
        should(() => new ReactorScenario(DefaultFiltered, { artifacts: { eventTypes: [] } })).not.throw();
    });
    it('should allow the existing unrestricted reducer scenario', () => {
        should(() => new ReadModelScenario(State, { reducers: [DefaultFiltered], eventTypes: [], projections: [] })).not.throw();
    });
});
