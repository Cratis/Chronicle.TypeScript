// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, type Constructor } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { removeConstraint } from '../../../events/constraints/removeConstraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { eventSequenceScenarioBehaviors } from './event_sequence_scenario_behaviors.fixture.js';

@eventType('OracleDomainText')
class Text { @field(String) key: string; constructor(key: string) { this.key = key; } }
@eventType('OracleDomainRemoved')
class Removed { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleFirst')
class First { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleSibling')
class Sibling { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleRemoved')
@removeConstraint('OracleSequencedCycle')
class CycleRemoved { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleExpired')
@removeConstraint('OracleSequencedCycle')
class CycleExpired { @field(String) label: string; constructor(label: string) { this.label = label; } }

const outbox = new EventSequenceId('outbox');

function constraints(caseName: string): Constructor[] {
    function select(builder: IConstraintBuilder): IConstraintBuilder {
        if (caseName.endsWith('-event-log-and-outbox')) return builder.forEventSequences('outbox', EventSequenceId.eventLog);
        return caseName.endsWith('-event-log') ? builder.forEventLog() : builder.forEventSequences(outbox);
    }
    @constraint('OracleSequencedKey')
    class Key {
        define(builder: IConstraintBuilder) {
            select(builder).unique(key => key.on(Text, event => event.key).removedWith(Removed).withMessage('Taken: {PropertyValue}'));
        }
    }
    @constraint('OracleSequencedFirst')
    class FirstCycle { define(builder: IConstraintBuilder) { select(builder).uniqueFor(First, 'Cycle occupied', 'OracleSequencedCycle'); } }
    @constraint('OracleSequencedSibling')
    class SiblingCycle { define(builder: IConstraintBuilder) { select(builder).uniqueFor(Sibling, 'Cycle occupied', 'OracleSequencedCycle'); } }
    @constraint('OracleSequencedOnceConstraint')
    class Once { define(builder: IConstraintBuilder) { select(builder).uniqueFor(First, 'Already recorded', 'OracleSequencedOnce'); } }
    const kind = caseName.split('-')[0];
    return kind === 'property' ? [Key] : kind === 'once' ? [Once] : [FirstCycle, SiblingCycle];
}

describe('when appending event sequence constraints with standard decorators', () => {
    eventSequenceScenarioBehaviors({ string: Text, removed: Removed, first: First, sibling: Sibling,
        cycleRemoved: CycleRemoved, cycleExpired: CycleExpired }, constraints);
});
