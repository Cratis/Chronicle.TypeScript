// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when reconnecting a read model watcher', () => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
        watcher = context.readModels.createWatcher(context.model, { resume: true });
    });
    afterEach(() => context.readModels.dispose());

    it('should replace resolved readiness at disconnect and continue the same iterator after a fresh acknowledgment', async () => {
        context.streams[0].send({ Subscribed: true });
        const firstReadiness = watcher.subscribed;
        await firstReadiness;
        const iterator = watcher[Symbol.asyncIterator]();
        const next = iterator.next();
        await context.disconnect();
        context.streams[0].signal.aborted.should.be.true;
        watcher.subscribed.should.not.equal(firstReadiness);
        let ready = false;
        void watcher.subscribed.then(() => { ready = true; });
        await context.connect();
        await context.flush();
        ready.should.be.false;
        context.streams[1].send({ Subscribed: true });
        await watcher.subscribed;
        ready.should.be.true;
        context.streams[1].send({ ModelKey: 'new', ReadModel: '{"id":"new"}' });
        (await next).value.key.should.equal('new');
    });

    it('should preserve still pending readiness across a disconnect before acknowledgment', async () => {
        const pending = watcher.subscribed;
        await context.disconnect();
        watcher.subscribed.should.equal(pending);
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        await pending;
    });

    it('should deliver buffered changes from the previous connection before new changes', async () => {
        context.streams[0].send({ Subscribed: true });
        context.streams[0].send({ ModelKey: 'old', ReadModel: '{"id":"old"}' });
        await watcher.subscribed;
        await context.flush();
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        context.streams[1].send({ ModelKey: 'new', ReadModel: '{"id":"new"}' });
        const iterator = watcher[Symbol.asyncIterator]();
        (await iterator.next()).value.key.should.equal('old');
        (await iterator.next()).value.key.should.equal('new');
    });

    it('should acknowledge a new subscription before consuming its buffered changes', async () => {
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const iterator = watcher[Symbol.asyncIterator]();
        await context.disconnect();
        const readiness = watcher.subscribed;
        await context.connect();
        context.streams[1].send({ ModelKey: 'new', ReadModel: '{"id":"new"}' });
        context.streams[1].send({ Subscribed: true });
        await readiness;
        (await iterator.next()).value.key.should.equal('new');
    });

    it('should not create duplicate streams for repeated connected notifications', async () => {
        await context.connect();
        context.streams.should.have.lengthOf(1);
    });

    it('should not restart a disposed watcher', async () => {
        watcher.dispose();
        await context.disconnect();
        await context.connect();
        context.streams.should.have.lengthOf(1);
    });

    it('should defer opening a watcher created while disconnected', async () => {
        watcher.dispose();
        await context.disconnect();
        watcher = context.readModels.createWatcher(context.model);
        context.streams.should.have.lengthOf(1);
        await context.connect();
        context.streams.should.have.lengthOf(2);
        context.streams[1].send({ Subscribed: true });
        await watcher.subscribed;
    });
});
