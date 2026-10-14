// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { Model } from '../given/a_read_model_with_defaults.js';
import { Address } from '../given/Address.js';

const should = chai.should();

describe('when restoring with absent fields', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{}');
    });

    it('should keep the null default', () => should.equal(result.title, null));
    it('should keep the non-null default', () => result.status.should.equal('available'));
    it('should keep the nested object default', () => result.address.should.deep.equal(new Address()));
    it('should deserialize an absent array to an empty array', () => result.children.should.deep.equal([]));
});
