// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_reactor_whose_stream_ends } from './given/a_reactor_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reactor observation stream and a stream stayed open before it ended', () => {
    let context: a_reactor_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reactor_whose_stream_ends();
        context.scripts.push({}, {}, { openForMs: 180_000 }, { untilAborted: true });
        await context.reactors.register();
        await vi.advanceTimersByTimeAsync(185_000);
    });

    afterEach(() => context.dispose());

    it('should start the wait over at the base delay after the stream that stayed open', () =>
        context.waits.should.deep.equal([1_000, 2_000, 181_000]));
});
