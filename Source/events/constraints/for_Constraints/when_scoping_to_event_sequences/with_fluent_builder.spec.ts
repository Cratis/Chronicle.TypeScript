// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it } from 'vitest';
import type { Constraint } from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../../../../eventSequences/EventSequenceId.js';
import { eventType } from '../../../eventTypeDecorator.js';
import { constraint } from '../../constraint.js';
import type { IConstraintBuilder } from '../../IConstraintBuilder.js';
import { registeredConstraints } from './given/registered_constraints.js';

chai.should();

class NameRegistered { name = ''; }
class OnlyOnce {}
eventType('name-registered')(NameRegistered);
eventType('only-once')(OnlyOnce);

class UnscopedName { define(builder: IConstraintBuilder) { builder.unique(unique => unique.on(NameRegistered, event => event.name)); } }
constraint('unscoped-name')(UnscopedName);
class EventLogName { define(builder: IConstraintBuilder) { builder.unique(unique => unique.on(NameRegistered, event => event.name)).forEventLog(); } }
constraint('event-log-name')(EventLogName);
class SelectedOnce {
    define(builder: IConstraintBuilder) {
        builder.forEventSequences(new EventSequenceId('outbox'), 'inbox', ' ', 'outbox')
            .uniqueFor(OnlyOnce, undefined, 'selected-once')
            .forEventSequences(EventSequenceId.eventLog);
    }
}
constraint('selected-once-constraint')(SelectedOnce);

describe('when scoping constraints to event sequences with the fluent builder', () => {
    let registered: Map<string, Constraint>;
    beforeAll(async () => { registered = await registeredConstraints([UnscopedName, EventLogName, SelectedOnce]); });

    it('should register an unscoped constraint for every event sequence', () => registered.get('unscoped-name')!.EventSequences.should.deep.equal([]));
    it('should register a constraint declared after the definition for the event log', () => registered.get('event-log-name')!.EventSequences.should.deep.equal(['event-log']));
    it('should register distinct nonblank event sequences across every call in declaration order', () =>
        registered.get('selected-once')!.EventSequences.should.deep.equal(['outbox', 'inbox', 'event-log']));
});
