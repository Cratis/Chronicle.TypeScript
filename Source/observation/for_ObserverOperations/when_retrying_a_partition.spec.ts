// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import { PartitionRetryOutcome } from '../PartitionRetryOutcome.js';
import { observer_operations } from './given/observer_operations.js';

chai.should();

describe('when retrying a partition of an observer', () => {
    let context: observer_operations;
    let outcome: PartitionRetryOutcome;
    beforeEach(async () => {
        context = new observer_operations();
        context.retryPartition.mockResolvedValue({ Outcome: PartitionRecoveryOutcome.PartitionQuarantined });
        outcome = await context.operations.retryPartition('obs', 'custom', 'p1');
    });
    it('should send the exact request including the partition', () =>
        context.retryPartition.mock.calls[0][0].should.deep.equal(
            { EventStore: 'store', Namespace: 'tenant', ObserverId: 'obs', EventSequenceId: 'custom', Partition: 'p1' }));
    it('should return the outcome the kernel reported', () => outcome.should.equal(PartitionRetryOutcome.PartitionQuarantined));
});

describe('when asking for the failed partitions of an observer', () => {
    let context: observer_operations;
    beforeEach(async () => {
        context = new observer_operations();
        await context.operations.getFailedPartitions('obs');
    });
    it('should ask the failed partitions service for that observer in the store and namespace', () =>
        context.failedPartitions.mock.calls[0][0].should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'obs' }));
});
