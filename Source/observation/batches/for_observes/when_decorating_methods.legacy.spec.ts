// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { getObservedEventTypes, observes } from '../observes.js';

chai.should();

class First {}
class Second {}

class Observer {
    @observes(First)
    @observes(Second)
    both() {}
}

describe('when decorating methods with observes using legacy decorators', () => {
    it('should collect every observed event type of a method', () =>
        getObservedEventTypes(Observer.prototype.both).length.should.equal(2));
    it('should refuse a static method', () => (() => {
        class Static {
            @observes(First)
            static batch() {}
        }
        return Static;
    }).should.throw(TypeError, 'public, string-named instance method'));
});
