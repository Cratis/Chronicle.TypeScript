// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { removeConstraint } from '../../../events/constraints/removeConstraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { EventScenario, UnsupportedEventSequenceOperation } from '../../index.js';

chai.should();
@eventType('UnprovenScopedFirst')
class First { @field(String) label = 'First'; }
@eventType('UnprovenScopedSecond')
class Second { @field(String) label = 'Second'; }
@eventType('UnprovenScopedRenewed')
@removeConstraint('UnprovenScopedCycle')
class Renewed { @field(String) label = 'Renewed'; }
@eventType('UnprovenScopedRemoved')
@removeConstraint('UnprovenScopedCycle')
class Removed { @field(String) label = 'Removed'; }
@eventType('UnprovenScopedExpired')
@removeConstraint('UnprovenScopedCycle')
class Expired { @field(String) label = 'Expired'; }

function constraints(scoped: boolean): Function[] {
    return [First, Second, Renewed].map((type, index) => {
        @constraint(`UnprovenScopedDeclaration${index}`)
        class Cycle {
            define(builder: IConstraintBuilder) {
                if (scoped) builder.perEventStreamId();
                builder.uniqueFor(type, 'Occupied', 'UnprovenScopedCycle');
            }
        }
        return Cycle;
    });
}

describe('when configuring a scoped covered-and-removal cycle', () => {
    it('should reject that scoped interaction specifically while preserving its unscoped support', () => {
        const eventTypes = [First, Second, Renewed, Removed, Expired];
        new EventScenario({ artifacts: { eventTypes, constraints: constraints(false) } }).should.be.instanceOf(EventScenario);
        (() => new EventScenario({ artifacts: { eventTypes, constraints: constraints(true) } }))
            .should.throw(UnsupportedEventSequenceOperation, 'Scoped covered-and-removal event cycles are not fixture-backed.');
    });
});
