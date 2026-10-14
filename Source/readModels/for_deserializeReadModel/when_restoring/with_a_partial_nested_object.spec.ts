// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { Model } from '../given/a_read_model_with_defaults.js';
import { Address } from '../given/Address.js';

const should = chai.should();

describe('when restoring with a partial nested object', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{"address":{"city":"Oslo"}}');
    });

    it('should restore the nested type', () => result.address.should.be.instanceOf(Address));
    it('should keep the absent nested field default', () => result.address.street.should.equal('Default street'));
    it('should replace the present nested field default', () => result.address.city!.should.equal('Oslo'));
});

describe('when restoring with explicit null in a nested object', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{"address":{"street":null}}');
    });

    it('should replace the non-null nested field default', () => should.equal(result.address.street, null));
});
