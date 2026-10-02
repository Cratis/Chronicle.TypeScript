// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { DayOfWeek, FacetName, type FacetSet, TimeBucket } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

describe('when querying at a moment with additional facets', () => {
    let context: a_patterns_service;
    const facets: FacetSet = Object.freeze({
        [FacetName.AggregateType]: 'Invoice',
        [FacetName.CommandType]: 'RegisterInvoice',
        [FacetName.Day]: DayOfWeek.Friday,
        [FacetName.TimeBucket]: TimeBucket.Evening,
        CustomFacet: 'custom-value'
    });
    beforeEach(async () => {
        context = new a_patterns_service();
        await context.patterns.getPatternsAt('user-42', {
            instant: new Date('2026-01-04T23:30:00Z'), offsetMinutes: 345
        }, { alsoConstraining: facets, minimumConfidence: 0.8, maximumResults: 5 });
    });
    it('should ask about usual actions in the explicit offset day and bucket', () => {
        context.client.usualActions.mock.calls[0][0].should.deep.equal({
            EventStore: 'accounts', Namespace: 'tenant-a', GroupingKey: 'user-42',
            Context: { ...facets, Day: DayOfWeek.Monday, TimeBucket: TimeBucket.EarlyMorning },
            MinimumConfidence: 0.8, MaximumResults: 5
        });
    });
    it('should not use the descriptive matching endpoint', () => context.client.matchingPatterns.mock.calls.should.have.lengthOf(0));
    it('should leave the caller context unchanged', () => facets[FacetName.Day].should.equal(DayOfWeek.Friday));
});
