// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { a_reactor_whose_stream_ends } from './given/a_reactor_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reactor observation stream and a replaced stream fails late', () => {
    let context: a_reactor_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reactor_whose_stream_ends();
        context.scripts.push(
            { untilAborted: true, endsLateByMs: 10, error: new ClientError('/Reactors/Observe', Status.INTERNAL, 'boom') },
            { untilAborted: true });
        await context.reactors.register();
        await vi.advanceTimersByTimeAsync(0);
        await context.reconnect();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => context.dispose());

    it('should not open the stream again', () => context.openedAt.should.have.lengthOf(2));
    it('should leave exactly one stream open', () => context.stream.open.should.equal(1));
});
