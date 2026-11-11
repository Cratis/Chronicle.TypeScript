// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationReconnectBackoff } from '../ObservationReconnectBackoff.js';

chai.should();

describe('when the settings are not finite', () => {
    let delays: number[];

    beforeEach(() => {
        let now = 0;
        const backoff = new ObservationReconnectBackoff({
            baseDelayMs: Number.NaN,
            maxDelayMs: -1,
            healthyStreamDurationMs: Number.POSITIVE_INFINITY,
            now: () => now,
            nextJitter: () => 1
        });
        delays = [];
        for (let attempt = 0; attempt < 7; attempt++) {
            backoff.streamOpened();
            delays.push(backoff.nextDelayMs());
        }
        now = ObservationReconnectBackoff.defaultHealthyStreamDurationMs;
        delays.push(backoff.nextDelayMs());
    });

    it('should fall back to the default delays', () =>
        delays.should.deep.equal([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 2_000]));
});
