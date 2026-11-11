// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_backoff } from './given/a_backoff.js';

chai.should();

describe('when a stream stayed open before it ended', () => {
    let longEnough: number;
    let tooShort: number;

    beforeEach(() => {
        const healthy = new a_backoff();
        for (let attempt = 0; attempt < 3; attempt++) healthy.streamEndsAfter(1_000);
        longEnough = healthy.streamEndsAfter(a_backoff.healthyStreamDurationMs);

        const unhealthy = new a_backoff();
        for (let attempt = 0; attempt < 3; attempt++) unhealthy.streamEndsAfter(1_000);
        tooShort = unhealthy.streamEndsAfter(a_backoff.healthyStreamDurationMs - 1);
    });

    it('should start the wait over at the base delay once it stayed open long enough', () => longEnough.should.equal(a_backoff.baseDelayMs / 2));
    it('should keep backing off when it closed just before counting as having worked', () => tooShort.should.equal(8_000));
});
