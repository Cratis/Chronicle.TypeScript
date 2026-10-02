// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

describe('when querying an invalid moment', () => {
    let context: a_patterns_service;
    let failure: unknown;
    beforeEach(async () => {
        context = new a_patterns_service();
        try {
            await context.patterns.getPatternsAt('user-42', { instant: new Date(NaN), offsetMinutes: 0 });
        } catch (error) { failure = error; }
    });
    it('should reject the query', () => (failure as Error).should.be.instanceOf(RangeError));
    it('should not send a misleading context to the kernel', () => context.client.usualActions.mock.calls.should.have.lengthOf(0));
});
