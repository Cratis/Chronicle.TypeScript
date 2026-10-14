// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { Model } from '../given/a_read_model_with_defaults.js';

const should = chai.should();

describe('when restoring with explicit null', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{"status":null,"address":null,"children":null}');
    });

    it('should replace the non-null scalar default', () => should.equal(result.status, null));
    it('should replace the nested object default', () => should.equal(result.address, null));
    it('should replace the array default', () => should.equal(result.children, null));
});
