// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reducer observation stream and it is disposed while it waits to reopen', () => {
    let context: a_reducer_whose_stream_ends;
    let timersAfterDispose: number;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.scripts.push({});
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(0);
        context.reducers.dispose();
        timersAfterDispose = vi.getTimerCount();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => context.dispose());

    it('should not open the stream again', () => context.openedAt.should.have.lengthOf(1));
    it('should leave no timer behind', () => timersAfterDispose.should.equal(0));
});
