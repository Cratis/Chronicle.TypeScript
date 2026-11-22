// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import { PartitionRetryOutcome } from '../../../observation/PartitionRetryOutcome.js';
import { runtime_reactors } from '../given/runtime_reactors.fixture.js';
import { request, ReactorId } from './given/managed_reactors.js';

chai.should();

describe('when retrying a partition of an unknown reactor id', () => {
    let context: runtime_reactors;
    let outcome: PartitionRetryOutcome;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.retryPartition.mockResolvedValue({ Outcome: PartitionRecoveryOutcome.PartitionNotFound });
        outcome = await context.reactors.retryFailedPartition(new ReactorId('nobody'), 'p1');
    });
    afterEach(() => context.reactors.dispose());
    it('should target the event log with the partition', () =>
        context.retryPartition.mock.calls[0][0].should.deep.equal({ ...request('nobody', 'event-log'), Partition: 'p1' }));
    it('should return the mapped outcome', () => outcome.should.equal(PartitionRetryOutcome.PartitionNotFound));
});

describe('when asking for the failed partitions of a decorated reactor', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        await context.reactors.getFailedPartitionsFor('on-custom');
    });
    afterEach(() => context.reactors.dispose());
    it('should ask for that observer in the store and namespace', () =>
        context.failedPartitions.mock.calls[0][0].should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'on-custom' }));
});
