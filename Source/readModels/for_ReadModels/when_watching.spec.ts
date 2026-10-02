// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReadModelChangeType as ContractChangeType } from '@cratis/chronicle.contracts';
import { Guid } from '@cratis/fundamentals';
import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { toContractsGuid } from '../../connection/Guid.js';
import { ReadModelChangeType } from '../ReadModelChangeType.js';
import { a_watched_read_model } from '../for_ReadModelWatcher/given/a_watched_read_model.js';

chai.should();

describe('when watching with the original pull-based API', () => {
    let context: a_watched_read_model;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
    });
    afterEach(() => context.readModels.dispose());

    it('should not open or read the stream until the first next call', async () => {
        const changes = context.readModels.watch(context.model);
        await context.flush();
        context.watch.mock.calls.should.have.lengthOf(0);
        const iterator = changes[Symbol.asyncIterator]();
        await context.flush();
        context.watch.mock.calls.should.have.lengthOf(0);
        const next = iterator.next();
        context.watch.mock.calls.should.have.lengthOf(1);
        context.streams[0].pulls.should.equal(1);
        context.streams[0].send({ ModelKey: 'first', ReadModel: '{}' });
        (await next).value.key.should.equal('first');
        await iterator.return!();
        context.streams[0].closed.should.be.true;
    });

    it('should defer model resolution failures until iteration starts', async () => {
        const changes = context.readModels.watch(class Unknown {});
        context.watch.mock.calls.should.have.lengthOf(0);
        const failure = await changes[Symbol.asyncIterator]().next().catch(error => error);
        failure.message.should.contain("Unknown read model 'Unknown'");
    });

    it.each([0, 2050, undefined])('should pull more than the watcher buffer limit without read-ahead or overflow (acknowledgment after %s changes)', async acknowledgeAfter => {
        const iterator = context.readModels.watch(context.model)[Symbol.asyncIterator]();
        const first = iterator.next();
        const stream = context.streams[0];
        if (acknowledgeAfter === 0) stream.send({ Subscribed: true });
        for (let index = 0; index < 2050; index++) {
            stream.send({ ModelKey: `${index}`, ReadModel: '{}' });
        }
        if (acknowledgeAfter === 2050) stream.send({ Subscribed: true });
        stream.end();
        try {
            for (let index = 0; index < 2050; index++) {
                const result = await (index === 0 ? first : iterator.next());
                result.done!.should.be.false;
                result.value.key.should.equal(`${index}`);
                if (index === 0 || index === 1024 || index === 2049) {
                    // Simulate a slow consumer: no next() means no further transport pulls.
                    await context.flush();
                    stream.pulls.should.equal(index + 1 + (acknowledgeAfter === 0 ? 1 : 0));
                }
            }
            (await iterator.next()).done!.should.be.true;
        } finally {
            await iterator.return!();
        }
    });

    it('should retain optional change kind and context on pull-based changes', async () => {
        const iterator = context.readModels.watch(context.model)[Symbol.asyncIterator]();
        const next = iterator.next();
        const correlationId = '12345678-1234-5678-9abc-123456789abc';
        const occurred = '2026-06-07T08:09:10.123Z';
        context.streams[0].send({ Namespace: 'tenant', ModelKey: 'one', ReadModel: '{"id":"one"}',
            ChangeType: ContractChangeType.Added, EventSequenceNumber: 9007199254740997n,
            CorrelationId: toContractsGuid(Guid.as(correlationId)), Occurred: { Value: occurred } });
        const change = (await next).value;
        change.changeType.should.equal(ReadModelChangeType.Added);
        change.changeContext.should.deep.equal({ eventStore: 'store', namespace: 'tenant',
            sequenceNumber: 9007199254740997n, correlationId, occurred: new Date(occurred) });
        await iterator.return!();
    });
});
