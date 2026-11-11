// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reducer observation stream and streams keep ending without working', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.scripts.push({}, { error: new ClientError('/Reducers/Observe', Status.UNAVAILABLE, 'kernel stopping') });
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(60_000);
    });

    afterEach(() => context.dispose());

    it('should double the wait each time a stream ends', () => context.waits.slice(0, 5).should.deep.equal([1_000, 2_000, 4_000, 8_000, 16_000]));
    it('should not reconnect the client', () => context.reconnectRequests.should.be.empty);
});
