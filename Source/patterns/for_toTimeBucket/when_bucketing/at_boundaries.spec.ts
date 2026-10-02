// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { TimeBucket, toTimeBucket } from '../../index.js';

chai.should();

// Chronicle v19.26.2: TimeBucketExtensions.ToTimeBucket uses >= start and < end on the offset's hour.
const boundaries: [string, TimeBucket][] = [
    ['00:00:00.000', TimeBucket.Night],
    ['04:59:59.999', TimeBucket.Night],
    ['05:00:00.000', TimeBucket.EarlyMorning],
    ['07:59:59.999', TimeBucket.EarlyMorning],
    ['08:00:00.000', TimeBucket.Morning],
    ['10:59:59.999', TimeBucket.Morning],
    ['11:00:00.000', TimeBucket.Midday],
    ['13:59:59.999', TimeBucket.Midday],
    ['14:00:00.000', TimeBucket.Afternoon],
    ['16:59:59.999', TimeBucket.Afternoon],
    ['17:00:00.000', TimeBucket.Evening],
    ['21:59:59.999', TimeBucket.Evening],
    ['22:00:00.000', TimeBucket.Night],
    ['23:59:59.999', TimeBucket.Night]
];

for (const offsetMinutes of [0, 330, -210, 345, -840, 840]) {
    for (const [time, expected] of boundaries) {
        describe(`when bucketing ${time} at offset ${offsetMinutes}`, () => {
            let result: TimeBucket;
            beforeEach(() => {
                const wallClock = new Date(`2026-01-05T${time}Z`);
                const instant = new Date(wallClock.getTime() - offsetMinutes * 60_000);
                result = toTimeBucket({ instant, offsetMinutes });
            });
            it('should use the same inclusive and exclusive boundaries as the miner', () => result.should.equal(expected));
        });
    }
}
