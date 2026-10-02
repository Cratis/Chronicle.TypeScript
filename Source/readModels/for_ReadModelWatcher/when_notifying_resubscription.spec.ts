// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when notifying read model resubscription', () => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
        watcher = context.readModels.createWatcher(context.model);
    });
    afterEach(() => context.readModels.dispose());

    it('should notify once per acknowledged resubscription and ignore duplicate markers', async () => {
        const callback = vi.fn();
        watcher.onResubscribed(callback);
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        for (let generation = 1; generation <= 2; generation++) {
            await context.disconnect();
            await context.connect();
            callback.mock.calls.should.have.lengthOf(generation - 1);
            context.streams[generation].send({ Subscribed: true });
            context.streams[generation].send({ Subscribed: true });
            await context.flush();
            callback.mock.calls.should.have.lengthOf(generation);
        }
    });

    it('should not notify for the first acknowledgment after an unacknowledged disconnect', async () => {
        const callback = vi.fn();
        watcher.onResubscribed(callback);
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        await watcher.subscribed;
        await context.flush();
        callback.mock.calls.should.have.lengthOf(0);
    });

    it('should unregister callbacks idempotently without removing other callbacks', async () => {
        const removed = vi.fn();
        const remaining = vi.fn();
        const unsubscribe = watcher.onResubscribed(removed);
        watcher.onResubscribed(remaining);
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        unsubscribe();
        unsubscribe();
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        await context.flush();
        removed.mock.calls.should.have.lengthOf(0);
        remaining.mock.calls.should.have.lengthOf(1);
    });

    it('should await refresh callbacks in registration order before delivering resumed changes', async () => {
        let finishRefresh!: () => void;
        const refresh = new Promise<void>(resolve => { finishRefresh = resolve; });
        const calls: string[] = [];
        watcher.onResubscribed(async () => {
            calls.push('refresh');
            await refresh;
        });
        watcher.onResubscribed(() => { calls.push('refreshed'); });
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const next = watcher[Symbol.asyncIterator]().next().then(change => {
            calls.push('change');
            return change;
        });
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        context.streams[1].send({ ModelKey: 'new', ReadModel: '{}' });
        await context.flush();
        calls.should.deep.equal(['refresh']);
        finishRefresh();
        (await next).value.key.should.equal('new');
        calls.should.deep.equal(['refresh', 'refreshed', 'change']);
    });

    it.each([false, true])('should fail iteration on a callback failure even with a transport code (async: %s)', async asynchronous => {
        const failure = { code: 14 };
        watcher.onResubscribed(() => {
            if (asynchronous) return Promise.reject(failure);
            throw failure;
        });
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        (await next).should.equal(failure);
        context.streams[1].signal.aborted.should.be.true;
        await context.disconnect();
        await context.connect();
        context.streams.should.have.lengthOf(2);
    });

    it('should stop notifying callbacks when disposed during a refresh', async () => {
        const remaining = vi.fn();
        watcher.onResubscribed(() => watcher.dispose());
        watcher.onResubscribed(remaining);
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const next = watcher[Symbol.asyncIterator]().next();
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        (await next).done!.should.be.true;
        await context.flush();
        remaining.mock.calls.should.have.lengthOf(0);
        const unsubscribe = watcher.onResubscribed(remaining);
        unsubscribe();
        await context.disconnect();
        await context.connect();
        context.streams.should.have.lengthOf(2);
    });
});
