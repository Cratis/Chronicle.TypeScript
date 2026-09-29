// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { classNamePolicy, registerReducer, upperCasePolicy, type RegisteredReadModel } from '../given/registered_read_models.js';

chai.should();

describe('when registering a reducer without a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await registerReducer();
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountActivity'));
    it('should name the container by the identifier', () => registered.containerName.should.equal('AccountActivity'));
});

describe('when registering a reducer with a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await registerReducer(upperCasePolicy);
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountActivity'));
    it('should keep the display name', () => registered.displayName.should.equal('AccountActivity'));
    it('should name the container with the policy result', () => registered.containerName.should.equal('ACCOUNTACTIVITY'));
});

describe('when registering a reducer with a naming policy that uses the class', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await registerReducer(classNamePolicy);
    });

    it('should hand the read model class to the policy', () => registered.containerName.should.equal('AccountActivity:AccountActivity'));
});
