// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { CompositeKeyBuilder } from '../CompositeKeyBuilder.js';

chai.should();

class Key { orderId!: string; }
class Changed { orderId!: string; }

for (const first of ['two-argument', 'completed', 'unfinished'] as const) {
    for (const second of ['two-argument', 'one-argument'] as const) {
        describe(`when setting a duplicate composite part using ${second} after ${first}`, () => {
            let builder: CompositeKeyBuilder<Key, Changed>;
            let duplicate: () => unknown;

            beforeEach(() => {
                builder = new CompositeKeyBuilder<Key, Changed>();
                if (first === 'two-argument') builder.set(key => key.orderId, event => event.orderId);
                if (first === 'completed') builder.set(key => key.orderId).toValue('original');
                if (first === 'unfinished') builder.set(key => key.orderId);
                duplicate = () => second === 'two-argument'
                    ? builder.set(key => key.orderId, event => event.orderId)
                    : builder.set(key => key.orderId);
            });

            it('should reject the duplicate as soon as the target is selected', () => {
                duplicate.should.throw("Composite key part 'orderId' is already configured.");
            });
        });
    }
}

describe('when continuing after a rejected duplicate composite part', () => {
    it('should retain the original part without reserving another part', () => {
        const builder = new CompositeKeyBuilder<Key, Changed>();
        const original = builder.set(key => key.orderId);
        (() => builder.set(key => key.orderId)).should.throw();
        original.toValue('original');
        builder.build().should.equal('$composite(orderId=$value(original))');
    });
});
