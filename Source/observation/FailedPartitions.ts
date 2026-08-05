// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FailedPartition as ContractsFailedPartition } from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../connection';
import { fromContractsGuid } from '../connection/Guid';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';
import { FailedPartition } from './FailedPartition';
import { IFailedPartitions } from './IFailedPartitions';

/**
 * Implements {@link IFailedPartitions} by proxying to the Chronicle Kernel over the client connection.
 */
export class FailedPartitions implements IFailedPartitions {
    /**
     * Creates a new {@link FailedPartitions} instance.
     * @param _eventStore - Event store name.
     * @param _namespace - Event store namespace.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async getAllFailedPartitions(): Promise<FailedPartition[]> {
        return this.getFailedPartitions('');
    }

    /** @inheritdoc */
    async getFailedPartitionsFor(observerId: string): Promise<FailedPartition[]> {
        return this.getFailedPartitions(observerId);
    }

    private async getFailedPartitions(observerId: string): Promise<FailedPartition[]> {
        const response = await this._connection.failedPartitions.getFailedPartitions({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ObserverId: observerId
        });

        return (response.items ?? []).map(failedPartition => this.toClientFailedPartition(failedPartition));
    }

    private toClientFailedPartition(failedPartition: ContractsFailedPartition): FailedPartition {
        return {
            id: fromContractsGuid(failedPartition.Id).toString(),
            observerId: failedPartition.ObserverId,
            partition: failedPartition.Partition,
            attempts: (failedPartition.Attempts ?? []).map(attempt => ({
                occurred: new Date(attempt.Occurred?.Value ?? ''),
                sequenceNumber: new EventSequenceNumber(attempt.SequenceNumber ?? 0n),
                messages: attempt.Messages ?? [],
                stackTrace: attempt.StackTrace ?? ''
            }))
        };
    }
}
