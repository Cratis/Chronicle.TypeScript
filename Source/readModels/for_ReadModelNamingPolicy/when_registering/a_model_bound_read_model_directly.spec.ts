// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { classNamePolicy, directModelBound, upperCasePolicy, type RegisteredReadModel } from '../given/registered_read_models.js';

chai.should();

describe('when registering a model-bound read model directly without a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directModelBound();
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountBalance'));
    it('should name the container by the identifier', () => registered.containerName.should.equal('AccountBalance'));
});

describe('when registering a model-bound read model directly with a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directModelBound(upperCasePolicy);
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountBalance'));
    it('should keep the display name', () => registered.displayName.should.equal('AccountBalance'));
    it('should name the container with the policy result', () => registered.containerName.should.equal('ACCOUNTBALANCE'));
});

describe('when registering a model-bound read model directly with a naming policy that uses the class', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directModelBound(classNamePolicy);
    });

    it('should hand the read model class to the policy', () => registered.containerName.should.equal('AccountBalance:AccountBalance'));
});
