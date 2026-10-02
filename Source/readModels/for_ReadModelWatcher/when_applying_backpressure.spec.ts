// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when applying read model watch backpressure', () => {
    let context: a_watched_read_model;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
    });
    afterEach(() => context.readModels.dispose());

    it('should pause a created watcher for a slow consumer and deliver more than the buffer limit without failure', async () => {
        const iterator = context.readModels.createWatcher(context.model)[Symbol.asyncIterator]();
        const stream = context.streams[0];
        stream.send({ Subscribed: true });
        for (let index = 0; index < 2050; index++) stream.send({ ModelKey: `${index}`, ReadModel: '{}' });
        await context.flush();
        stream.pulls.should.equal(1025); // One acknowledgment and 1,024 buffered changes.
        stream.signal.aborted.should.be.false;
        (await iterator.next()).value.key.should.equal('0');
        await context.flush();
        stream.pulls.should.equal(1026);
        for (let index = 1; index < 2050; index++) {
            (await iterator.next()).value.key.should.equal(`${index}`);
        }
        stream.end();
        (await iterator.next()).done!.should.be.true;
    });

    it('should reach acknowledgment with a full pre-acknowledgment buffer then pause until consumption', async () => {
        const watcher = context.readModels.createWatcher(context.model);
        const stream = context.streams[0];
        for (let index = 0; index < 1024; index++) stream.send({ ModelKey: `${index}`, ReadModel: '{}' });
        stream.send({ Subscribed: true });
        stream.send({ ModelKey: 'after', ReadModel: '{}' });
        await watcher.subscribed;
        await context.flush();
        stream.pulls.should.equal(1025);
        const iterator = watcher[Symbol.asyncIterator]();
        for (let index = 0; index < 1024; index++) (await iterator.next()).value.key.should.equal(`${index}`);
        (await iterator.next()).value.key.should.equal('after');
    });

    it('should cancel a paused read on disposal', async () => {
        const watcher = context.readModels.createWatcher(context.model);
        const stream = context.streams[0];
        stream.send({ Subscribed: true });
        for (let index = 0; index < 1024; index++) stream.send({ ReadModel: '{}' });
        await context.flush();
        watcher.dispose();
        await context.flush();
        stream.closed.should.be.true;
        stream.signal.aborted.should.be.true;
        stream.pulls.should.equal(1025);
        (await watcher[Symbol.asyncIterator]().next()).done!.should.be.true;
    });

    it('should read eagerly again until each resumed stream acknowledges even with a full buffer', async () => {
        const watcher = context.readModels.createWatcher(context.model, { resume: true });
        context.streams[0].send({ Subscribed: true });
        for (let index = 0; index < 1024; index++) context.streams[0].send({ ModelKey: `${index}`, ReadModel: '{}' });
        await context.flush();
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        context.streams[1].send({ ModelKey: 'resumed', ReadModel: '{}' });
        await watcher.subscribed;
        await context.flush();
        context.streams[0].closed.should.be.true;
        context.streams[1].pulls.should.equal(1);
        const iterator = watcher[Symbol.asyncIterator]();
        for (let index = 0; index < 1024; index++) (await iterator.next()).value.key.should.equal(`${index}`);
        (await iterator.next()).value.key.should.equal('resumed');
    });
});
