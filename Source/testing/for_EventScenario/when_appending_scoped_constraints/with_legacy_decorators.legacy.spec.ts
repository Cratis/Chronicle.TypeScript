// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field, type Constructor } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import { removeConstraint } from '../../../events/constraints/removeConstraint.js';
import type { ConstraintScopeCapture } from '../../../events/constraints/ConstraintBuilder.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { scopeScenarioBehaviors } from './scope_scenario_behaviors.fixture.js';

@eventType('OracleDomainText')
class Text { @field(String) key: string; constructor(key: string) { this.key = key; } }
@eventType('OracleDomainShared')
class Shared { @field(String) key: string; constructor(key: string) { this.key = key; } }
@eventType('OracleDomainRemoved')
class Removed { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleDomainExpired')
class Expired { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleFirst')
class First { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleSibling')
class Sibling { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleRemoved')
@removeConstraint('OracleScopedCycle')
class CycleRemoved { @field(String) label: string; constructor(label: string) { this.label = label; } }
@eventType('OracleCycleExpired')
@removeConstraint('OracleScopedCycle')
class CycleExpired { @field(String) label: string; constructor(label: string) { this.label = label; } }

function constraints(scope: ConstraintScopeCapture, kind: string): Constructor[] {
    function apply(builder: IConstraintBuilder): IConstraintBuilder {
        if (scope.perEventSourceType) builder.perEventSourceType();
        if (scope.perEventStreamType) builder.perEventStreamType();
        if (scope.perEventStreamId) builder.perEventStreamId();
        return builder;
    }
    @constraint('OracleScopedKey')
    class Key {
        define(builder: IConstraintBuilder) {
            apply(builder).unique(key => key.on(Text, event => event.key).on(Shared, event => event.key)
                .removedWith(Removed).removedWith(Expired).withMessage('Taken: {PropertyValue}'));
        }
    }
    @constraint('OracleScopedFirst')
    class FirstCycle { define(builder: IConstraintBuilder) { apply(builder).uniqueFor(First, 'Cycle occupied', 'OracleScopedCycle'); } }
    @constraint('OracleScopedSibling')
    class SiblingCycle { define(builder: IConstraintBuilder) { apply(builder).uniqueFor(Sibling, 'Cycle occupied', 'OracleScopedCycle'); } }
    return kind === 'property' ? [Key] : kind === 'once' ? [FirstCycle] : [FirstCycle, SiblingCycle];
}

describe('when appending scoped constraints with legacy decorators', () => {
    scopeScenarioBehaviors({ string: Text, shared: Shared, removed: Removed, expired: Expired,
        first: First, sibling: Sibling, cycleRemoved: CycleRemoved, cycleExpired: CycleExpired }, constraints);
});
