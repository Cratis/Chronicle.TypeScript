// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe.each([1, 4, 13, 14, undefined])('when a read model stream ends with status %s before the connection notices', code => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    const endStream = () => {
        if (code === undefined) context.streams[0].end();
        else context.streams[0].fail({ code });
    };
    beforeEach(async () => {
        vi.useFakeTimers();
        context = new a_watched_read_model();
        await context.connect();
        watcher = context.readModels.watch(context.model);
    });
    afterEach(() => {
        context.readModels.dispose();
        vi.useRealTimers();
    });

    it('should renew readiness and deliver the next connection change to the same pending iterator', async () => {
        context.streams[0].send({ Subscribed: true });
        const acknowledged = watcher.subscribed;
        await acknowledged;
        const iterator = watcher[Symbol.asyncIterator]();
        const next = iterator.next();
        endStream();
        await vi.advanceTimersByTimeAsync(0);
        watcher.subscribed.should.not.equal(acknowledged);
        const readiness = watcher.subscribed;
        await context.disconnect();
        watcher.subscribed.should.equal(readiness);
        await vi.advanceTimersByTimeAsync(1000);
        context.streams.should.have.lengthOf(1);
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        await readiness;
        context.streams[1].send({ ModelKey: 'next', ReadModel: '{}' });
        (await next).value.key.should.equal('next');
        await vi.advanceTimersByTimeAsync(1000);
        context.streams.should.have.lengthOf(2);
    });

    it('should preserve pending readiness and retry if the lifecycle never disconnects', async () => {
        const readiness = watcher.subscribed;
        endStream();
        await vi.advanceTimersByTimeAsync(0);
        watcher.subscribed.should.equal(readiness);
        context.streams.should.have.lengthOf(1);
        await vi.advanceTimersByTimeAsync(1000);
        context.streams.should.have.lengthOf(2);
        context.streams[1].send({ Subscribed: true });
        await readiness;
    });

    it('should cancel a scheduled restart when disposed', async () => {
        const readiness = watcher.subscribed.catch(error => error);
        endStream();
        await vi.advanceTimersByTimeAsync(0);
        watcher.dispose();
        await vi.advanceTimersByTimeAsync(1000);
        (await readiness).name.should.equal('AbortError');
        context.streams.should.have.lengthOf(1);
    });
});
