// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { removeConstraint } from '../../../events/constraints/removeConstraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import type { EventContext } from '../../../events/EventContext.js';
import { reactor } from '../../../reactors/reactor.js';
import { ReactorScenario } from '../../ReactorScenario.js';

chai.should();
@eventType('ScopedReactorFirst')
class First { @field(String) label = 'First'; }
@eventType('ScopedReactorSibling')
class Sibling { @field(String) label = 'Sibling'; }
@eventType('ScopedReactorRemoved')
@removeConstraint('ScopedReactorCycle')
class Removed { @field(String) label = 'Removed'; }
@eventType('ScopedReactorExpired')
@removeConstraint('ScopedReactorCycle')
class Expired { @field(String) label = 'Expired'; }
@eventType('ScopedReactorEffect')
class Effect { @field(String) label: string; constructor(label: string) { this.label = label; } }
@constraint('ScopedReactorFirstCycle')
class FirstCycle {
    define(builder: IConstraintBuilder) { builder.perEventSourceType().perEventStreamType().perEventStreamId().uniqueFor(First, 'Occupied', 'ScopedReactorCycle'); }
}
@constraint('ScopedReactorSiblingCycle')
class SiblingCycle {
    define(builder: IConstraintBuilder) { builder.perEventSourceType().perEventStreamType().perEventStreamId().uniqueFor(Sibling, 'Occupied', 'ScopedReactorCycle'); }
}

describe('when enforcing scoped reactor constraints on default-route input', () => {
    it('should deliver only accepted cycles and retain no effects or deliveries from rejected actions', async () => {
        const calls: EventContext[] = [];
        @reactor('ScopedReactor')
        class Reactor {
            first(event: First, context: EventContext) { calls.push(context); return new Effect(event.label); }
            sibling(event: Sibling, context: EventContext) { calls.push(context); return new Effect(event.label); }
        }
        const scenario = new ReactorScenario(Reactor, { artifacts: {
            eventTypes: [First, Sibling, Removed, Expired, Effect], constraints: [FirstCycle, SiblingCycle]
        } });
        await scenario.given.forEventSource('A').events(new First());
        await scenario.when.forEventSource('A').events(new Sibling()).then(
            () => { throw new Error('Conflicting cycle delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
                (error as Error).message.should.include('ScopedReactorCycle');
            });
        calls.length.should.equal(1);
        scenario.produced.length.should.equal(1);
        scenario.results.length.should.equal(1);
        scenario.appendedEvents.length.should.equal(1);
        await scenario.when.forEventSource('A').events(new Removed(), new Sibling());
        await scenario.when.forEventSource('A').events(new Expired(), new First(), new Sibling()).then(
            () => { throw new Error('Invalid batch delivered'); }, error => {
                (error as Error).message.should.include('ReactorScenario action append failed');
            });
        calls.length.should.equal(2);
        scenario.produced.length.should.equal(2);
        scenario.results.length.should.equal(2);
        scenario.appendedEvents.length.should.equal(3);
        calls.map(context => [context.eventSourceType, context.eventStreamType, context.eventStreamId])
            .should.deep.equal([['Default', 'All', 'Default'], ['Default', 'All', 'Default']]);
    });
});
