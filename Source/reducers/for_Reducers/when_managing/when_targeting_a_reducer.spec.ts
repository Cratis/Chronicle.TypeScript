// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import { PartitionRetryOutcome } from '../../../observation/PartitionRetryOutcome.js';
import { ReducerId } from '../../ReducerId.js';
import { managed_reducers, NotAReducer, OnCustomSequence, request } from '../given/managed_reducers.js';

chai.should();

describe('when managing a reducer by type', () => {
    let context: managed_reducers;
    beforeEach(async () => {
        context = new managed_reducers();
        context.replay.mockResolvedValue({ JobId: 'b6cd0b44-5ad3-4b3d-9f17-5a8b2f0a6e11' });
        await context.reducers.getStateFor(OnCustomSequence);
    });
    afterEach(() => context.reducers.dispose());
    it('should target the declared id and sequence for state', () => context.information.mock.calls[0][0].should.deep.equal(request('on-custom', 'custom')));
    it('should target the declared sequence for replay and report the job', async () => {
        const result = await context.reducers.replay(OnCustomSequence);
        context.replay.mock.calls[0][0].should.deep.equal(request('on-custom', 'custom'));
        result.started.should.be.true;
    });
});

describe('when managing a discovered reducer by id', () => {
    let context: managed_reducers;
    beforeEach(async () => {
        context = new managed_reducers();
        context.artifacts.push(OnCustomSequence);
        context.retryPartition.mockResolvedValue({ Outcome: PartitionRecoveryOutcome.ObserverQuarantined });
    });
    afterEach(() => context.reducers.dispose());
    it('should resolve the declared sequence from the known classes before discovery', async () => {
        const outcome = await context.reducers.retryFailedPartition(new ReducerId('on-custom'), 'p1');
        context.retryPartition.mock.calls[0][0].should.deep.equal({ ...request('on-custom', 'custom'), Partition: 'p1' });
        outcome.should.equal(PartitionRetryOutcome.ObserverQuarantined);
    });
    it('should resolve the declared sequence after discovery', async () => {
        await context.reducers.discover();
        await context.reducers.getStateFor('on-custom');
        context.information.mock.calls[0][0].should.deep.equal(request('on-custom', 'custom'));
    });
});

describe('when managing an unknown reducer id', () => {
    let context: managed_reducers;
    beforeEach(async () => {
        context = new managed_reducers();
        await context.reducers.replay('nobody');
        await context.reducers.getFailedPartitionsFor('nobody');
    });
    afterEach(() => context.reducers.dispose());
    it('should target the event log and not report a started replay', async () => {
        context.replay.mock.calls[0][0].should.deep.equal(request('nobody', 'event-log'));
        (await context.reducers.replay('nobody')).started.should.be.false;
    });
    it('should ask for the failed partitions of that observer', () =>
        context.failedPartitions.mock.calls[0][0].should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'nobody' }));
});

describe('when managing a reducer with an undecorated class', () => {
    let context: managed_reducers;
    let failure: unknown;
    beforeEach(async () => {
        context = new managed_reducers();
        await context.reducers.replay(NotAReducer).catch(error => { failure = error; });
    });
    afterEach(() => context.reducers.dispose());
    it('should reject naming the class', () => (failure as Error).message.should.equal("'NotAReducer' is not a reducer."));
    it('should send no request', () => context.replay.mock.calls.length.should.equal(0));
});
