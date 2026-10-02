// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { DayOfWeek, FacetName, TimeBucket } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

for (const withOptions of [false, true]) {
    describe(`when querying now ${withOptions ? 'with additional facets' : 'with only a scope'}`, () => {
        let context: a_patterns_service;
        beforeEach(async () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-01-05T01:00:00Z'));
            // Simulate a machine west of UTC regardless of the machine running the specs.
            vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(240);
            context = new a_patterns_service();
            if (withOptions) {
                await context.patterns.getPatternsAt('user-42', undefined, { alsoConstraining: { [FacetName.AggregateType]: 'Invoice' } });
            } else {
                await context.patterns.getPatternsAt('user-42');
            }
        });
        afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
        it('should capture now at the local system offset with server default limits', () => {
            context.client.usualActions.mock.calls[0][0].should.deep.equal({
                EventStore: 'accounts', Namespace: 'tenant-a', GroupingKey: 'user-42',
                Context: {
                    ...(withOptions ? { AggregateType: 'Invoice' } : {}),
                    Day: DayOfWeek.Sunday, TimeBucket: TimeBucket.Evening
                },
                MinimumConfidence: 0, MaximumResults: 0
            });
        });
    });
}
