// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { a_reducer_whose_stream_ends } from './given/a_reducer_whose_stream_ends.js';
import { page } from '../given/observe_reducer_messages.js';
import { Reducers } from '../../Reducers.js';

chai.should();

describe('when reconnecting a reducer observation stream and reducing failed with a lost session', () => {
    let context: a_reducer_whose_stream_ends;

    beforeEach(async () => {
        context = new a_reducer_whose_stream_ends();
        vi.spyOn(Reducers.prototype as unknown as { beginReduction: () => unknown }, 'beginReduction').mockImplementationOnce(() => {
            throw new ClientError('/ReadModels/Get', Status.UNKNOWN, 'ClientIsNotConnected: connection is not connected');
        });
        context.scripts.push({ deliver: [page(1n, {})], untilAborted: true }, { untilAborted: true });
        await context.reducers.register();
        await vi.advanceTimersByTimeAsync(120_000);
    });

    afterEach(() => {
        context.dispose();
        vi.restoreAllMocks();
    });

    it('should not ask the whole client to reconnect', () => context.reconnectRequests.should.be.empty);
    it('should open the stream again after the base delay', () => context.waits.should.deep.equal([1_000]));
    it('should close the stream the reducer failed on', () => context.stream.open.should.equal(1));
});
