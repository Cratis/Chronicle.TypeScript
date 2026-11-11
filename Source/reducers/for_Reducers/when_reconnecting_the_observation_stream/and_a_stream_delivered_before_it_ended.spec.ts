// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';
import { page } from '../given/observe_reducer_messages.js';

chai.should();

describe('when reconnecting a reducer observation stream and a stream delivered before it ended', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.scripts.push({}, {}, { deliver: [page(1n, {})] }, {});
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(6_500);
    });

    afterEach(() => context.dispose());

    it('should start the wait over at the base delay after the stream that delivered', () =>
        context.waits.slice(0, 4).should.deep.equal([1_000, 2_000, 1_000, 2_000]));
});
