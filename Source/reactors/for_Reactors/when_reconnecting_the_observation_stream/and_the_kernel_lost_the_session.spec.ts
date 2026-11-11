// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { a_reactor_whose_stream_ends } from './given/a_reactor_whose_stream_ends.js';

chai.should();

describe('when reconnecting a reactor observation stream and the kernel lost the session', () => {
    let context: a_reactor_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reactor_whose_stream_ends();
        context.scripts.push({ error: new ClientError('/Reactors/Observe', Status.UNKNOWN, 'ClientIsNotConnected: connection is not connected') });
        await context.reactors.register();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => context.dispose());

    it('should ask the whole client to reconnect', () => context.reconnectRequests.should.deep.equal(['reactor-session-lost']));
    it('should not open the stream again with the same connection', () => context.openedAt.should.have.lengthOf(1));
});
