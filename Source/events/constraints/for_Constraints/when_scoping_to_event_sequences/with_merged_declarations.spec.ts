// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeAll, chai, describe, it } from 'vitest';
import type { Constraint } from '@cratis/chronicle.contracts';
import { eventType } from '../../../eventTypeDecorator.js';
import { constraint } from '../../constraint.js';
import type { IConstraintBuilder } from '../../IConstraintBuilder.js';
import { registeredConstraints } from './given/registered_constraints.js';

chai.should();

class Opened {}
class Closed {}
class Archived {}
eventType('merge-opened')(Opened);
eventType('merge-closed')(Closed);
eventType('merge-archived')(Archived);

class OpenedOnLog { define(builder: IConstraintBuilder) { builder.forEventLog().uniqueFor(Opened, undefined, 'narrowed'); } }
constraint('opened-on-log')(OpenedOnLog);
class ClosedOnOutbox { define(builder: IConstraintBuilder) { builder.forEventSequences('outbox').uniqueFor(Closed, undefined, 'narrowed'); } }
constraint('closed-on-outbox')(ClosedOnOutbox);
class OpenedEverywhere { define(builder: IConstraintBuilder) { builder.uniqueFor(Opened, undefined, 'widened'); } }
constraint('opened-everywhere')(OpenedEverywhere);
class ArchivedOnLog { define(builder: IConstraintBuilder) { builder.forEventLog().uniqueFor(Archived, undefined, 'widened'); } }
constraint('archived-on-log')(ArchivedOnLog);

describe('when scoping merged unique event type declarations to event sequences', () => {
    let registered: Map<string, Constraint>;
    beforeAll(async () => { registered = await registeredConstraints([OpenedOnLog, ClosedOnOutbox, OpenedEverywhere, ArchivedOnLog]); });

    it('should combine the event sequences of every declaration', () => registered.get('narrowed')!.EventSequences.should.deep.equal(['event-log', 'outbox']));
    it('should keep a constraint applying everywhere when one declaration names no event sequence', () =>
        registered.get('widened')!.EventSequences.should.deep.equal([]));
});
