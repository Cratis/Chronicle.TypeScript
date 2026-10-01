// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles } from '../../events/handles.js';
import { ReducerReadModelProcessor } from '../ReducerReadModelProcessor.js';

chai.should();

@eventType('scenario-field-reducer')
class AuthorRegistered {}
class Model {}
class Base {
    @handles(AuthorRegistered) update() { return new Model(); }
}
class Derived extends Base {
    override update = () => new Model();
}

describe('when a reducer scenario instance field hides an inherited handler', () => {
    it('should reject the instance before processing events', async () => {
        const processor = new ReducerReadModelProcessor(Model, Derived, [AuthorRegistered]);
        const [result] = await Promise.allSettled([processor.process([])]);
        result.status.should.equal('rejected');
        if (result.status === 'rejected') (result.reason as Error).message.should.equal(
            "Override 'update' on 'Derived' hides @handles(AuthorRegistered) declared on 'Base'; use a method with @handles instead of an instance field.");
    });
});
