// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { CompositeKeyBuilder, type ICompositeKeyBuilder } from '../index.js';

chai.should();

class Key {
    number!: number;
    text!: string;
    nullable!: string | null;
    sourceNumber!: number;
}
class Changed { number!: number; }

// Checked by test:standard-types. Do not execute invalid configurations at runtime.
function rejectMismatchedConstants(builder: ICompositeKeyBuilder<Key, Changed>): void {
    // @ts-expect-error A number key part cannot receive a string constant.
    builder.set(key => key.number).toValue('orders');
    // @ts-expect-error A string key part cannot receive a number constant.
    builder.set(key => key.text).toValue(42);
    // @ts-expect-error Null requires a nullable key part.
    builder.set(key => key.text).toValue(null);
}

function rejectOnConcreteBuilder(builder: CompositeKeyBuilder<Key, Changed>): void {
    // @ts-expect-error The concrete overload must not fall back to an untyped accessor.
    builder.set(key => key.number).toValue('orders');
}
void rejectMismatchedConstants;
void rejectOnConcreteBuilder;

describe('when typing constant composite parts', () => {
    it('should accept selected property types and preserve fluent chaining', () => {
        const builder: ICompositeKeyBuilder<Key, Changed> = new CompositeKeyBuilder<Key, Changed>();
        builder.set(key => key.number).toValue(42)
            .set(key => key.text).toValue('orders')
            .set(key => key.nullable).toValue(null)
            .set(key => key.sourceNumber, event => event.number);
        builder.build().should.equal('$composite(number=$value(42),text=$value(orders),nullable=$null,sourceNumber=number)');
    });
});
