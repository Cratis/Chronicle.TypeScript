// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reducer observation stream and the kernel lost the session', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        context.endings.push(new ClientError('/Reducers/Observe', Status.UNKNOWN, 'ClientIsNotConnected: connection is not connected'));
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => context.dispose());

    it('should ask the whole client to reconnect', () => context.reconnectRequests.should.deep.equal(['reducer-session-lost']));
    it('should not open the stream again with the same connection', () => context.openedAt.should.have.lengthOf(1));
});
