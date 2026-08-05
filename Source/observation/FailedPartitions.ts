// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { FailedPartition } from './FailedPartition';
import { IFailedPartitions } from './IFailedPartitions';
import { toClientFailedPartition } from './toClientFailedPartition';

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

        return (response.items ?? []).map(failedPartition => toClientFailedPartition(failedPartition));
    }
}
