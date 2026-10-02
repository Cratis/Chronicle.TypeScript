// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe.each(['transport', 'stream', 'connection'] as const)('when a read model watcher has buffered changes before a terminal %s failure', kind => {
    let context: a_watched_read_model;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
    });
    afterEach(() => context.readModels.dispose());

    it.each([false, true])('should drain received changes before rejecting with the original error (acknowledged: %s)', async acknowledged => {
        const watcher = context.readModels.createWatcher(context.model, { resume: kind !== 'transport' });
        const readiness = watcher.subscribed.catch(error => error);
        const stream = context.streams[0];
        if (acknowledged) {
            stream.send({ Subscribed: true });
            await readiness;
        }
        stream.send({ ModelKey: 'first', ReadModel: '{"id":"first"}' });
        stream.send({ ModelKey: 'second', ReadModel: '{"id":"second"}' });
        await context.flush();
        const failure = Object.assign(new Error('terminal failure'), { code: kind === 'transport' ? 14 : 7 });
        if (kind === 'connection') await context.lifecycle.failed(failure, error => { throw error; });
        else stream.fail(failure);
        await context.flush();
        if (!acknowledged) (await readiness).should.equal(failure);
        stream.signal.aborted.should.be.true;
        const iterator = watcher[Symbol.asyncIterator]();
        (await iterator.next()).value.should.contain({ key: 'first' });
        (await iterator.next()).value.should.contain({ key: 'second' });
        (await iterator.next().catch(error => error)).should.equal(failure);
    });
});
