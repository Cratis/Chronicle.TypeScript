// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_backoff } from './given/a_backoff.js';

chai.should();

describe('when streams keep ending without working', () => {
    let context: a_backoff;
    let delays: number[];

    beforeEach(() => {
        context = new a_backoff();
        context.jitter = 0.999999;
        delays = Array.from({ length: 8 }, () => context.streamEndsAfter(1_000));
    });

    it('should double the wait each time, starting from the base delay', () =>
        delays.slice(0, 5).map(delay => Math.round(delay / 1_000)).should.deep.equal([2, 4, 8, 16, 32]));

    it('should never wait longer than the ceiling', () => delays.forEach(delay => delay.should.be.at.most(a_backoff.maxDelayMs)));
    it('should keep waiting close to the ceiling once it is reached', () => delays.slice(5).forEach(delay => delay.should.be.at.least(59_999)));
});
