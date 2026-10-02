// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { DayOfWeek, toDayOfWeek } from '../../index.js';

chai.should();

const cases: [string, number, DayOfWeek][] = [
    ['2026-01-04T23:59:59.999Z', 0, DayOfWeek.Sunday],
    ['2026-01-05T00:00:00.000Z', 0, DayOfWeek.Monday],
    ['2026-01-06T12:00:00Z', 0, DayOfWeek.Tuesday],
    ['2026-01-07T12:00:00Z', 0, DayOfWeek.Wednesday],
    ['2026-01-08T12:00:00Z', 0, DayOfWeek.Thursday],
    ['2026-01-09T12:00:00Z', 0, DayOfWeek.Friday],
    ['2026-01-10T12:00:00Z', 0, DayOfWeek.Saturday],
    ['2026-01-04T23:30:00Z', 120, DayOfWeek.Monday],
    ['2026-01-05T00:30:00Z', -120, DayOfWeek.Sunday],
    ['2025-12-31T23:30:00Z', 345, DayOfWeek.Thursday],
    ['2026-01-01T00:30:00Z', -210, DayOfWeek.Wednesday],
    ['2026-01-04T12:00:00Z', 840, DayOfWeek.Monday],
    ['2026-01-05T12:00:00Z', -840, DayOfWeek.Sunday]
];

for (const [instant, offsetMinutes, expected] of cases) {
    describe(`when reading the day of ${instant} at offset ${offsetMinutes}`, () => {
        let result: DayOfWeek;
        beforeEach(() => result = toDayOfWeek({ instant: new Date(instant), offsetMinutes }));
        it('should name the day at the moment offset rather than UTC', () => result.should.equal(expected));
    });
}
