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

fractionalCollisions({ number: NumberClaimed, text: TextClaimed, constraint: SharedKey, scoped: ScopedKey });
