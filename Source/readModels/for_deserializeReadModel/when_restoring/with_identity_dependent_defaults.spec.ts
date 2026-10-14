// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { IdentityDefaults } from '../given/IdentityDefaults.fixture.js';

chai.should();

describe('when restoring with identity-dependent defaults', () => {
    let result: IdentityDefaults;

    beforeEach(() => {
        result = deserializeReadModel(IdentityDefaults, '{"name":"stored"}');
    });

    it('should keep the default referencing another member identical to that member', () => result.mirror.should.equal(result.original));
    it('should keep the default referencing its owner identical to the returned instance', () => result.owner.should.equal(result));
    it('should still replace a present decorated field', () => result.name.should.equal('stored'));
});
