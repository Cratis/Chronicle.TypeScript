// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when opting into watch overflow failure', () => {
    let context: a_watched_read_model;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
    });
    afterEach(() => context.readModels.dispose());

    it.each([false, true])('should fail instead of dropping changes above the explicit limit (acknowledged: %s)', async acknowledged => {
        const watcher = context.readModels.createWatcher(context.model, { maxBuffered: 2, resume: true });
        const readiness = watcher.subscribed.catch(error => error);
        if (acknowledged) {
            context.streams[0].send({ Subscribed: true });
            await readiness;
        }
        for (let index = 0; index < 3; index++) context.streams[0].send({ ReadModel: '{}' });
        await context.flush();
        const failure = await watcher[Symbol.asyncIterator]().next().catch(error => error);
        failure.message.should.contain('buffer exceeded 2 changes');
        if (!acknowledged) (await readiness).should.equal(failure);
        context.streams[0].signal.aborted.should.be.true;
        await context.disconnect();
        await context.connect();
        context.streams.should.have.lengthOf(1);
    });

    it.each([0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('should reject an invalid limit %s before opening a stream', maxBuffered => {
        (() => context.readModels.createWatcher(context.model, { maxBuffered })).should.throw(RangeError);
        context.streams.should.have.lengthOf(0);
    });
});
