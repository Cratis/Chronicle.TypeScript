// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when subscribing to read model changes', () => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
        watcher = context.readModels.watch(context.model);
    });
    afterEach(() => watcher.dispose());

    it('should start the stream without iteration and await the actual acknowledgment', async () => {
        let ready = false;
        void watcher.subscribed.then(() => { ready = true; });
        await context.flush();
        ready.should.be.false;
        context.watch.mock.calls[0][0].should.deep.equal({
            EventStore: 'store', Namespace: 'tenant', ReadModelIdentifier: 'Model', EventSequenceId: 'event-log'
        });
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        ready.should.be.true;
    });

    it('should not yield subscription markers or lose a change before iteration begins', async () => {
        context.streams[0].send({ Subscribed: true });
        context.streams[0].send({ Namespace: 'tenant', ModelKey: 'one', ReadModel: '{"id":"one"}' });
        await watcher.subscribed;
        await context.flush();
        const result = await watcher[Symbol.asyncIterator]().next();
        result.done!.should.be.false;
        result.value.key.should.equal('one');
    });

    it('should reject readiness if the stream ends without acknowledgment', async () => {
        const failure = watcher.subscribed.catch(error => error);
        context.streams[0].end();
        (await failure).message.should.contain('before subscription acknowledgment');
    });

    it('should settle iteration when a subscribed stream ends', async () => {
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        const pending = watcher[Symbol.asyncIterator]().next();
        context.streams[0].end();
        (await pending).done!.should.be.true;
    });
});
