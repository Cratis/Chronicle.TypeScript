// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { BehaviorPatternDetailsResponse } from '@cratis/chronicle.contracts';
import type { BehaviorPattern } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

describe('when browsing every pattern for a scope', () => {
    let context: a_patterns_service;
    let result: BehaviorPattern[];
    beforeEach(async () => {
        context = new a_patterns_service();
        context.response.Data = [BehaviorPatternDetailsResponse.create({ Id: 'pattern-1', GroupingKey: 'user-42' })];
        result = await context.patterns.getPatternsForScope('user-42');
    });
    it('should address the scope within the event store namespace without limits', () => {
        context.client.patternsForScope.mock.calls[0][0].should.deep.equal({
            EventStore: 'accounts', Namespace: 'tenant-a', GroupingKey: 'user-42'
        });
    });
    it('should convert the established patterns', () => result[0].id.should.equal('pattern-1'));
});
