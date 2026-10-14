// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { SetterDefaults } from '../given/SetterDefaults.fixture.js';

chai.should();

describe('when restoring with a non-idempotent setter and an absent sibling', () => {
    let result: SetterDefaults;

    beforeEach(() => {
        result = deserializeReadModel(SetterDefaults, '{"name":"stored"}');
    });

    it('should apply the setter transformation once', () => result.name.should.equal('prefix:stored'));
    it('should invoke the setter once', () => result.assignments.should.equal(1));
    it('should keep the absent sibling default', () => result.sibling.should.equal('default'));
});
