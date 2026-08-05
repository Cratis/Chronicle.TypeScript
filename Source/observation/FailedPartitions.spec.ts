// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection';
import { FailedPartitions } from './FailedPartitions';

function wireFailedPartition() {
    return {
        Id: { lo: 1n, hi: 0n },
        ObserverId: 'some-observer',
        Partition: 'some-partition',
        Attempts: [
            {
                Occurred: { Value: '2024-01-15T12:30:00.0000000+00:00' },
                SequenceNumber: 7n,
                Messages: ['Something went wrong'],
                StackTrace: 'at Foo.Bar()'
            }
        ]
    };
}

function createFailedPartitions(getFailedPartitionsResult?: unknown) {
    const getFailedPartitions = vi.fn().mockResolvedValue(getFailedPartitionsResult ?? { items: [] });
    const connection = { failedPartitions: { getFailedPartitions } } as unknown as ChronicleConnection;
    const failedPartitions = new FailedPartitions('my-event-store', 'my-namespace', connection);
    return { failedPartitions, getFailedPartitions };
}

describe('FailedPartitions', () => {
    describe('when getting all failed partitions', () => {
        const { failedPartitions, getFailedPartitions } = createFailedPartitions({ items: [wireFailedPartition()] });

        it('should call the RPC with an empty observer id and map the response', async () => {
            const result = await failedPartitions.getAllFailedPartitions();

            expect(getFailedPartitions).toHaveBeenCalledTimes(1);
            const request = getFailedPartitions.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.ObserverId).toEqual('');

            expect(result).toHaveLength(1);
            expect(result[0].observerId).toEqual('some-observer');
            expect(result[0].partition).toEqual('some-partition');
            expect(result[0].attempts).toHaveLength(1);
            expect(result[0].attempts[0].sequenceNumber.value).toEqual(7n);
            expect(result[0].attempts[0].messages).toEqual(['Something went wrong']);
            expect(result[0].attempts[0].stackTrace).toEqual('at Foo.Bar()');
        });
    });

    describe('when getting failed partitions for a specific observer', () => {
        const { failedPartitions, getFailedPartitions } = createFailedPartitions({ items: [wireFailedPartition()] });

        it('should call the RPC with the given observer id', async () => {
            await failedPartitions.getFailedPartitionsFor('some-observer');

            expect(getFailedPartitions).toHaveBeenCalledTimes(1);
            const request = getFailedPartitions.mock.calls[0][0];
            expect(request.ObserverId).toEqual('some-observer');
        });
    });

    describe('when there are no failed partitions', () => {
        const { failedPartitions } = createFailedPartitions({ items: [] });

        it('should return an empty array', async () => {
            const result = await failedPartitions.getAllFailedPartitions();

            expect(result).toEqual([]);
        });
    });
});
