// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe.each(['watch', 'createWatcher'] as const)('when %s has not opted into resumption', method => {
    let context: a_watched_read_model;
    beforeEach(async () => {
        vi.useFakeTimers();
        context = new a_watched_read_model();
        await context.connect();
    });
    afterEach(() => {
        context.readModels.dispose();
        vi.useRealTimers();
    });

    it.each([1, 4, 13, 14])('should reject iteration with the original transport error for status %s', async code => {
        const iterator = context.readModels[method](context.model)[Symbol.asyncIterator]();
        context.streams[0].send({ Subscribed: true });
        await vi.advanceTimersByTimeAsync(0);
        const next = iterator.next().catch(error => error);
        const failure = Object.assign(new Error('transport failed'), { code });
        // A keep-alive disconnect arriving first must not replace the watch stream error.
        await context.disconnect();
        context.streams[0].signal.aborted.should.be.false;
        context.streams[0].fail(failure);
        (await next).should.equal(failure);
        await context.connect();
        await vi.advanceTimersByTimeAsync(1000);
        context.streams.should.have.lengthOf(1);
    });

    it('should complete iteration without restarting after stream completion', async () => {
        const iterator = context.readModels[method](context.model)[Symbol.asyncIterator]();
        context.streams[0].send({ Subscribed: true });
        context.streams[0].send({ ModelKey: 'received', ReadModel: '{}' });
        context.streams[0].end();
        await vi.advanceTimersByTimeAsync(1000);
        (await iterator.next()).value.key.should.equal('received');
        (await iterator.next()).done!.should.be.true;
        context.streams.should.have.lengthOf(1);
    });

    it('should stop opting into resumption after the last callback is removed', async () => {
        const watcher = context.readModels.createWatcher(context.model);
        const unsubscribe = watcher.onResubscribed(() => {});
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        unsubscribe();
        const failure = { code: 14 };
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        context.streams[0].fail(failure);
        (await next).should.equal(failure);
        await vi.advanceTimersByTimeAsync(1000);
        context.streams.should.have.lengthOf(1);
    });
});
