// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { a_backoff } from './given/a_backoff.js';

chai.should();

describe('when a stream delivered before it ended', () => {
    let context: a_backoff;
    let delay: number;

    beforeEach(() => {
        context = new a_backoff();
        for (let attempt = 0; attempt < 4; attempt++) context.streamEndsAfter(1_000);
        context.backoff.streamOpened();
        context.backoff.streamDelivered();
        context.now += 1_000;
        delay = context.backoff.nextDelayMs();
    });

    it('should start the wait over at the base delay', () => delay.should.equal(a_backoff.baseDelayMs / 2));
});
