// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import { ReadModelWatcher } from '../ReadModelWatcher.js';
import { a_kernel_stream } from './given/a_kernel_stream.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when a read model stream cannot recover', () => {
    it.each([3, 7, 16])('should terminate on non-transport status %s', async code => {
        const context = new a_watched_read_model();
        await context.connect();
        const watcher = context.readModels.watch(context.model);
        const failure = { code };
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        try {
            context.streams[0].fail(failure);
            (await readiness).should.equal(failure);
            (await next).should.equal(failure);
            await context.disconnect();
            await context.connect();
            context.streams.should.have.lengthOf(1);
        } finally { watcher.dispose(); }
    });

    it('should not retry a transport-coded compliance or conversion failure', async () => {
        const lifecycle = new ConnectionLifecycle();
        await lifecycle.connected(error => { throw error; });
        const stream = new a_kernel_stream();
        const failure = { code: 14 };
        let opened = 0;
        const watcher = new ReadModelWatcher(() => { opened++; return stream; }, async () => { throw failure; }, new AbortController().signal, lifecycle);
        const readiness = watcher.subscribed.catch(error => error);
        const next = watcher.next().catch(error => error);
        try {
            stream.send({ ReadModel: '{}' });
            (await readiness).should.equal(failure);
            (await next).should.equal(failure);
            await lifecycle.disconnected(error => { throw error; });
            await lifecycle.connected(error => { throw error; });
            opened.should.equal(1);
        } finally { watcher.dispose(); }
    });

    it.each([false, true])('should end a standalone stream cleanly (acknowledged: %s)', async acknowledged => {
        const stream = new a_kernel_stream();
        const watcher = new ReadModelWatcher(() => stream, async () => { throw new Error('Unexpected data'); }, new AbortController().signal);
        try {
            if (acknowledged) {
                stream.send({ Subscribed: true });
                await watcher.subscribed;
            }
            const readiness = watcher.subscribed.catch(error => error);
            const next = watcher.next();
            stream.end();
            (await next).done!.should.be.true;
            if (!acknowledged) (await readiness).message.should.contain('before subscription acknowledgment');
            else await readiness;
        } finally { watcher.dispose(); }
    });
});
