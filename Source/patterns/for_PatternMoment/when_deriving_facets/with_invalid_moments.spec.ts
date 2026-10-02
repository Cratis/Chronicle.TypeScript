// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { type PatternMoment, toDayOfWeek, toTimeBucket } from '../../index.js';

chai.should();

const invalidMoments: PatternMoment[] = [
    { instant: new Date(NaN), offsetMinutes: 0 },
    { instant: new Date(0), offsetMinutes: NaN },
    { instant: new Date(0), offsetMinutes: Infinity },
    { instant: new Date(0), offsetMinutes: 1.5 },
    { instant: new Date(0), offsetMinutes: 841 },
    { instant: new Date(0), offsetMinutes: -841 },
    { instant: new Date(8_640_000_000_000_000), offsetMinutes: 60 }
];

for (const helper of [toDayOfWeek, toTimeBucket]) {
    for (const moment of invalidMoments) {
        describe(`when ${helper.name} receives ${moment.instant} at offset ${moment.offsetMinutes}`, () => {
            let failure: unknown;
            beforeEach(() => {
                try { helper(moment); } catch (error) { failure = error; }
            });
            it('should reject rather than silently ask about a different context', () => {
                (failure as Error).should.be.instanceOf(RangeError);
            });
        });
    }
}
