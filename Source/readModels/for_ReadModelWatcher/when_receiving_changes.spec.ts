// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { ReadModelChangeType as ContractChangeType } from '@cratis/chronicle.contracts';
import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { toContractsGuid } from '../../connection/Guid.js';
import type { IReadModelWatcher } from '../IReadModelWatcher.js';
import { ReadModelChangeType } from '../ReadModelChangeType.js';
import { a_watched_read_model } from './given/a_watched_read_model.js';

chai.should();

describe('when receiving read model changes', () => {
    let context: a_watched_read_model;
    let watcher: IReadModelWatcher<{ id: string }>;
    beforeEach(async () => {
        context = new a_watched_read_model();
        await context.connect();
        watcher = context.readModels.createWatcher(context.model);
        context.streams[0].send({ Subscribed: true });
        await watcher.subscribed;
    });
    afterEach(() => watcher.dispose());

    for (const [contractKind, kind] of [
        [ContractChangeType.Added, ReadModelChangeType.Added],
        [ContractChangeType.Modified, ReadModelChangeType.Modified],
        [ContractChangeType.Removed, ReadModelChangeType.Removed],
        [ContractChangeType.UNRECOGNIZED, ReadModelChangeType.Modified]
    ]) {
        it(`should preserve ${ContractChangeType[contractKind]} changes and their triggering context`, async () => {
            const removed = contractKind === ContractChangeType.Removed;
            const occurred = '2026-06-07T08:09:10.123Z';
            const correlationId = '12345678-1234-5678-9abc-123456789abc';
            context.streams[0].send({ Namespace: 'tenant', ModelKey: 'one', ReadModel: removed ? '' : '{"id":"one"}',
                Removed: removed, ChangeType: contractKind, EventSequenceNumber: 9007199254740997n,
                CorrelationId: toContractsGuid(Guid.as(correlationId)), Occurred: { Value: occurred } });
            const change = (await watcher[Symbol.asyncIterator]().next()).value;
            change.namespace.should.equal('tenant');
            change.key.should.equal('one');
            change.removed.should.equal(removed);
            change.readModel.should.be.instanceOf(context.model);
            change.changeType.should.equal(kind);
            change.changeContext.should.deep.equal({ eventStore: 'store', namespace: 'tenant',
                sequenceNumber: 9007199254740997n, correlationId, occurred: new Date(occurred) });
        });
    }

    it('should leave absent timestamp and correlation metadata absent', async () => {
        context.streams[0].send({ ReadModel: '{}' });
        const change = (await watcher[Symbol.asyncIterator]().next()).value;
        (change.changeContext.occurred === undefined).should.be.true;
        (change.changeContext.correlationId === undefined).should.be.true;
    });

    it.each(['', 'not a timestamp'])('should leave an empty or invalid timestamp (%s) absent', async value => {
        context.streams[0].send({ ReadModel: '{}', Occurred: { Value: value } });
        const change = (await watcher[Symbol.asyncIterator]().next()).value;
        (change.changeContext.occurred === undefined).should.be.true;
    });

    it('should surface a deserialization failure and stop the stream', async () => {
        const next = watcher[Symbol.asyncIterator]().next().catch(error => error);
        context.streams[0].send({ ReadModel: 'not json' });
        (await next).should.be.instanceOf(SyntaxError);
        context.streams[0].signal.aborted.should.be.true;
    });
});
