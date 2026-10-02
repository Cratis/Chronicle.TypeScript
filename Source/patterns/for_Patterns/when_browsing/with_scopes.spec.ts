// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

describe('when browsing established scopes', () => {
    let context: a_patterns_service;
    let result: string[];
    beforeEach(async () => {
        context = new a_patterns_service();
        context.scopesResponse.Data = [{ Id: 'user-42', Name: 'A name', UserName: 'a-user' }];
        result = await context.patterns.getScopes();
    });
    it('should return grouping keys rather than display names', () => result.should.deep.equal(['user-42']));
    it('should stay within the event store namespace', () => {
        context.client.allPatternScopes.mock.calls[0][0].should.deep.equal({ EventStore: 'accounts', Namespace: 'tenant-a' });
    });
});
