// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_backoff } from './given/a_backoff.js';

chai.should();

describe('when jittering the delay', () => {
    let delays: number[];

    beforeEach(() => {
        delays = [0, 0.5, -1, 2].map(jitter => {
            const context = new a_backoff();
            context.jitter = jitter;
            return context.streamEndsAfter(0);
        });
    });

    it('should land at half the wait for the lowest jitter', () => delays[0].should.equal(1_000));
    it('should land in the upper half of the wait', () => delays[1].should.equal(1_500));
    it('should clamp a jitter below zero to the lower bound', () => delays[2].should.equal(1_000));
    it('should clamp a jitter above one to the full wait', () => delays[3].should.equal(2_000));
});
