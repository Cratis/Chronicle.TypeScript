// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { fractionalCollisions } from './fractional_collisions.fixture.js';

class NumberClaimed { @field(Number) key = 1; }
eventType('OracleCombinedNumber')(NumberClaimed);
class TextClaimed { @field(String) key = ''; }
eventType('OracleCombinedText')(TextClaimed);
class PairClaimed { @field(Number) key = 1; @field(Number) suffix = 2; }
eventType('OracleFractionalPair')(PairClaimed);
class Removed {}
eventType('OracleFractionalRemoved')(Removed);
class SharedKey {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(NumberClaimed, event => event.key).on(TextClaimed, event => event.key)
            .withMessage('Taken: {PropertyName}={PropertyValue}'));
    }
}
constraint('OracleFractionalKey')(SharedKey);
class ScopedKey extends SharedKey {
    define(builder: IConstraintBuilder) { super.define(builder.perEventSourceType()); }
}
constraint('OracleFractionalKey')(ScopedKey);
class CompositeKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.key, event => event.suffix)); }
}
constraint('OracleFractionalComposite')(CompositeKey);
class RemovableKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(NumberClaimed, event => event.key).removedWith(Removed)); }
}
constraint('OracleFractionalRemovable')(RemovableKey);
class OverlapLeft {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.key)); }
}
constraint('OracleFractionalOverlapLeft')(OverlapLeft);
class OverlapRight {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.suffix)); }
}
constraint('OracleFractionalOverlapRight')(OverlapRight);

fractionalCollisions({ number: NumberClaimed, text: TextClaimed, constraint: SharedKey, scoped: ScopedKey, rejectedDefinitions: [
    { name: 'composite', eventTypes: [PairClaimed], constraints: [CompositeKey], eventType: PairClaimed },
    { name: 'removable', eventTypes: [NumberClaimed, Removed], constraints: [RemovableKey], eventType: NumberClaimed },
    { name: 'overlapping', eventTypes: [PairClaimed], constraints: [OverlapLeft, OverlapRight], eventType: PairClaimed }
] });
