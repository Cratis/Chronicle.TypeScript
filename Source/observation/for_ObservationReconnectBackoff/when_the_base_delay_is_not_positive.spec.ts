// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationReconnectBackoff } from '../ObservationReconnectBackoff.js';

chai.should();

describe('when the base delay is not positive', () => {
    let delays: number[];

    beforeEach(() => {
        const backoff = new ObservationReconnectBackoff({ baseDelayMs: 0, nextJitter: () => 0.5 });
        delays = [backoff.nextDelayMs(), backoff.nextDelayMs(), backoff.nextDelayMs()];
    });

    it('should use the base delay as it is, without backing off', () => delays.should.deep.equal([0, 0, 0]));
});
