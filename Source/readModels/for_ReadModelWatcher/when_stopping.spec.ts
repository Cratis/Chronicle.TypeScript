// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when stopping a read model watcher', () => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    let cancellation: AbortController;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
        cancellation = new AbortController();
        watcher = context.readModels.createWatcher(context.model, { signal: cancellation.signal });
    });
    afterEach(() => context.readModels.dispose());

    it('should cancel the transport and settle pending iteration and readiness on disposal', async () => {
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next();
        watcher.dispose();
        watcher.dispose();
        context.streams[0].signal.aborted.should.be.true;
        (await readiness).name.should.equal('AbortError');
        (await next).done!.should.be.true;
    });

    it('should complete iteration when the caller aborts', async () => {
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next();
        const reason = new Error('caller cancelled');
        cancellation.abort(reason);
        (await readiness).should.equal(reason);
        (await next).done!.should.be.true;
        context.streams[0].signal.aborted.should.be.true;
    });

    it('should not open a stream with an already aborted signal', async () => {
        watcher.dispose();
        cancellation.abort();
        watcher = context.readModels.createWatcher(context.model, { signal: cancellation.signal });
        const failure = await watcher.subscribed.catch(error => error);
        failure.name.should.equal('AbortError');
        context.streams.should.have.lengthOf(1);
    });

    it('should cancel on an early for await break', async () => {
        context.streams[0].send({ Subscribed: true });
        context.streams[0].send({ ReadModel: '{"id":"one"}' });
        for await (const change of watcher) {
            change.readModel.id.should.equal('one');
            break;
        }
        context.streams[0].signal.aborted.should.be.true;
    });

    it('should cancel watchers when their owner is disposed', async () => {
        const readiness = watcher.subscribed.catch(error => error);
        context.readModels.dispose();
        (await readiness).name.should.equal('AbortError');
        context.streams[0].signal.aborted.should.be.true;
    });

    it('should surface a stream failure to readiness and iteration', async () => {
        const failure = new Error('transport failed');
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        context.streams[0].fail(failure);
        (await readiness).should.equal(failure);
        (await next).should.equal(failure);
    });

    it('should surface a later stream failure without changing an already resolved promise', async () => {
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        context.streams[0].fail(new Error('later failure'));
        (await next).message.should.equal('later failure');
        await watcher.subscribed;
    });
});
