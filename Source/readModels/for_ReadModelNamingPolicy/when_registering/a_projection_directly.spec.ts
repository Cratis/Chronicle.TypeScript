// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { classNamePolicy, directProjection, upperCasePolicy, type RegisteredReadModel } from '../given/registered_read_models.js';

chai.should();

describe('when registering a projection read model directly without a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directProjection();
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountSummary'));
    it('should name the container by the identifier', () => registered.containerName.should.equal('AccountSummary'));
});

describe('when registering a projection read model directly with a naming policy', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directProjection(upperCasePolicy);
    });

    it('should keep the identifier', () => registered.identifier.should.equal('AccountSummary'));
    it('should keep the display name', () => registered.displayName.should.equal('AccountSummary'));
    it('should name the container with the policy result', () => registered.containerName.should.equal('ACCOUNTSUMMARY'));
});

describe('when registering a projection read model directly with a naming policy that uses the class', () => {
    let registered: RegisteredReadModel;

    beforeEach(async () => {
        [registered] = await directProjection(classNamePolicy);
    });

    it('should hand the read model class to the policy', () => registered.containerName.should.equal('AccountSummary:AccountSummary'));
});
