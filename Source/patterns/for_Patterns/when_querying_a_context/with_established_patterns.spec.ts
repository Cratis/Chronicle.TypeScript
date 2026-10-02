// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { BehaviorPatternDetailsResponse } from '@cratis/chronicle.contracts';
import type { BehaviorPattern } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

const should = chai.should();

describe('when querying a context with established patterns', () => {
    let result: BehaviorPattern[];
    beforeEach(async () => {
        const context = new a_patterns_service();
        context.response.Data = [
            BehaviorPatternDetailsResponse.create({
                Id: 'pattern-1', GroupingKey: 'user-42', Facets: { Day: 'Monday', CommandType: 'RegisterInvoice' },
                Confidence: 0.75, Support: 0.2, Occurrences: 9_007_199_254_740_993n, Weight: 3.5, Specificity: 2,
                FirstSeen: { Value: '2026-01-05T09:00:00+02:00' }, LastSeen: { Value: '2026-01-12T09:00:00+02:00' }
            }),
            BehaviorPatternDetailsResponse.create({ Id: 'pattern-2', Confidence: 0.95 })
        ];
        result = await context.patterns.getPatterns('user-42', {});
    });
    it('should convert every response field without losing occurrence precision', () => {
        result[0].should.deep.equal({
            id: 'pattern-1', groupingKey: 'user-42', facets: { Day: 'Monday', CommandType: 'RegisterInvoice' },
            confidence: 0.75, support: 0.2, occurrences: 9_007_199_254_740_993n, weight: 3.5, specificity: 2,
            firstSeen: new Date('2026-01-05T07:00:00Z'), lastSeen: new Date('2026-01-12T07:00:00Z')
        });
    });
    it('should preserve the server ranking', () => result.map(pattern => pattern.id).should.deep.equal(['pattern-1', 'pattern-2']));
    it('should not invent a missing observation timestamp', () => should.equal(result[1].firstSeen, undefined));
});
