// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { Model } from '../given/a_read_model_with_defaults.js';
import { Address } from '../given/Address.js';

const should = chai.should();

describe('when restoring with partial array items', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{"children":[{}, {"street":"Stored street","city":null}]}');
    });

    it('should replace the array default', () => result.children.should.have.lengthOf(2));
    it('should restore the child type', () => result.children[0].should.be.instanceOf(Address));
    it('should keep the absent child field default', () => result.children[0].street.should.equal('Default street'));
    it('should replace the present child field default', () => result.children[1].street.should.equal('Stored street'));
    it('should preserve the null child field', () => should.equal(result.children[1].city, null));
});
