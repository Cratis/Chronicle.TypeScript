// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reducer observation stream and the client reconnected after streams kept ending', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.scripts.push({}, {}, {}, { untilAborted: true });
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(1_000);
        await context.reconnect();
        await vi.advanceTimersByTimeAsync(4_000);
    });

    afterEach(() => context.dispose());

    it('should keep the wait it had grown to', () => context.waits.should.deep.equal([1_000, 0, 4_000]));
});
