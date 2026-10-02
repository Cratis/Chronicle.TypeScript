// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { ReadModelWatcher } from '../ReadModelWatcher.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when reconnecting during read model conversion', () => {
    let context: a_watched_read_model;
    let watcher: ReadModelWatcher<object>;
    let finishConversion: () => void;
    let failConversion: (error: unknown) => void;
    const converted: string[] = [];
    beforeEach(async () => {
        converted.length = 0;
        context = new a_watched_read_model();
        await context.connect();
        const conversion = new Promise<void>((resolve, reject) => {
            finishConversion = resolve;
            failConversion = reject;
        });
        watcher = new ReadModelWatcher(signal => context.watch(undefined, { signal }), async change => {
            converted.push(change.ModelKey);
            if (change.ModelKey === 'received') await conversion;
            return { namespace: change.Namespace, key: change.ModelKey, readModel: {}, removed: false };
        }, new AbortController().signal, context.lifecycle, { resume: true });
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
        context.streams[0].send({ ModelKey: 'received' });
        await context.flush();
        await context.disconnect();
        await context.connect();
        context.streams[1].send({ Subscribed: true });
        context.streams[1].send({ ModelKey: 'resumed' });
        await watcher.subscribed;
    });
    afterEach(() => {
        finishConversion();
        watcher.dispose();
        context.readModels.dispose();
    });

    it('should finish received conversion and preserve order across connections', async () => {
        await context.flush();
        converted.should.deep.equal(['received']);
        finishConversion();
        (await watcher.next()).value.key.should.equal('received');
        (await watcher.next()).value.key.should.equal('resumed');
        converted.should.deep.equal(['received', 'resumed']);
    });

    it('should not replay an acknowledgment to a callback registered while earlier conversion finishes', async () => {
        let notifications = 0;
        watcher.onResubscribed(() => { notifications++; });
        finishConversion();
        await context.flush();
        notifications.should.equal(0);
        await context.disconnect();
        await context.connect();
        context.streams[2].send({ Subscribed: true });
        await context.flush();
        notifications.should.equal(1);
    });

    it('should still fail on a received change that cannot be released after reconnect', async () => {
        const failure = { code: 14 };
        const next = watcher.next().catch(error => error);
        failConversion(failure);
        (await next).should.equal(failure);
        context.streams[1].signal.aborted.should.be.true;
        converted.should.deep.equal(['received']);
    });

    it('should not deliver an in-flight conversion after disposal', async () => {
        const next = watcher.next();
        watcher.dispose();
        finishConversion();
        (await next).done!.should.be.true;
        await context.flush();
        (await watcher.next()).done!.should.be.true;
    });
});
