// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationReconnectBackoff } from '../ObservationReconnectBackoff.js';

chai.should();

describe('when using the defaults', () => {
    let delays: number[];

    beforeEach(() => {
        let now = 0;
        const backoff = new ObservationReconnectBackoff({ now: () => now, nextJitter: () => 0.999999 });
        delays = Array.from({ length: 7 }, () => {
            backoff.streamOpened();
            now += 1_000;
            return backoff.nextDelayMs();
        });
        backoff.streamOpened();
        now += ObservationReconnectBackoff.defaultHealthyStreamDurationMs;
        delays.push(backoff.nextDelayMs());
    });

    it('should start at two seconds', () => Math.round(delays[0] / 1_000).should.equal(2));
    it('should never wait longer than a minute', () => delays.forEach(delay => delay.should.be.at.most(60_000)));
    it('should reach a minute while streams keep ending', () => Math.round(delays[6] / 1_000).should.equal(60));
    it('should start over after a stream stayed open for three minutes', () => Math.round(delays[7] / 1_000).should.equal(2));
});
