// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { getObservedEventTypes, isBatchMethod, observes } from '../observes.js';

chai.should();

class First {}
class Second {}

class Observer {
    @observes(First)
    @observes(Second)
    both() {}

    single() {}
}

describe('when decorating methods with observes', () => {
    it('should collect every observed event type of a method', () =>
        [...getObservedEventTypes(Observer.prototype.both)].sort((left, right) => left.name.localeCompare(right.name)).should.deep.equal([First, Second]));
    it('should make the method a batch method', () => isBatchMethod(Observer.prototype.both).should.be.true);
    it('should leave other methods alone', () => isBatchMethod(Observer.prototype.single).should.be.false);
    it('should refuse the same event type twice', () => (() => {
        class Duplicate {
            @observes(First)
            @observes(First)
            twice() {}
        }
        return Duplicate;
    }).should.throw(TypeError, "observes 'First' more than once"));
});
