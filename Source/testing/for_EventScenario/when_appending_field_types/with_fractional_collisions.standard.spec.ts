// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { fractionalCollisions } from './fractional_collisions.fixture.js';

@eventType('OracleCombinedNumber')
class NumberClaimed { @field(Number) key = 1; }
@eventType('OracleCombinedText')
class TextClaimed { @field(String) key = ''; }
@eventType('OracleFractionalPair')
class PairClaimed { @field(Number) key = 1; @field(Number) suffix = 2; }
@eventType('OracleFractionalRemoved')
class Removed {}
@constraint('OracleFractionalKey')
class SharedKey {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(NumberClaimed, event => event.key).on(TextClaimed, event => event.key)
            .withMessage('Taken: {PropertyName}={PropertyValue}'));
    }
}
@constraint('OracleFractionalKey')
class ScopedKey extends SharedKey {
    define(builder: IConstraintBuilder) { super.define(builder.perEventSourceType()); }
}
@constraint('OracleFractionalComposite')
class CompositeKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.key, event => event.suffix)); }
}
@constraint('OracleFractionalRemovable')
class RemovableKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(NumberClaimed, event => event.key).removedWith(Removed)); }
}
@constraint('OracleFractionalOverlapLeft')
class OverlapLeft {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.key)); }
}
@constraint('OracleFractionalOverlapRight')
class OverlapRight {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(PairClaimed, event => event.suffix)); }
}

fractionalCollisions({ number: NumberClaimed, text: TextClaimed, constraint: SharedKey, scoped: ScopedKey, rejectedDefinitions: [
    { name: 'composite', eventTypes: [PairClaimed], constraints: [CompositeKey], eventType: PairClaimed },
    { name: 'removable', eventTypes: [NumberClaimed, Removed], constraints: [RemovableKey], eventType: NumberClaimed },
    { name: 'overlapping', eventTypes: [PairClaimed], constraints: [OverlapLeft, OverlapRight], eventType: PairClaimed }
] });
