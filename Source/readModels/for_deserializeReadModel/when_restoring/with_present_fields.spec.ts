// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { deserializeReadModel } from '../../deserializeReadModel.js';
import { Model } from '../given/a_read_model_with_defaults.js';

chai.should();

describe('when restoring with present fields', () => {
    let result: Model;

    beforeEach(() => {
        result = deserializeReadModel(Model, '{"title":"Stored title","status":"borrowed"}');
    });

    it('should replace the null default', () => result.title!.should.equal('Stored title'));
    it('should replace the non-null default', () => result.status.should.equal('borrowed'));
});
