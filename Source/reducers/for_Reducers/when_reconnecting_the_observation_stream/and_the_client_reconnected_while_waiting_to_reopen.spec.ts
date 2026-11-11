// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reducer observation stream and the client reconnected while it waited to reopen', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.scripts.push({}, { untilAborted: true });
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(0);
        await context.reconnect();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => context.dispose());

    it('should only open the stream the reconnect registered', () => context.openedAt.should.have.lengthOf(2));
    it('should leave exactly one stream open', () => context.stream.open.should.equal(1));
});
