// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleConnection } from '../connection/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { FailedPartition } from './FailedPartition.js';
import { FailedPartitions } from './FailedPartitions.js';
import type { ObserverReplayResult } from './ObserverReplayResult.js';
import type { ObserverState } from './ObserverState.js';
import type { PartitionRetryOutcome } from './PartitionRetryOutcome.js';
import { toObserverReplayResult } from './toObserverReplayResult.js';
import { toObserverRunningState } from './toObserverRunningState.js';
import { toPartitionRetryOutcome } from './toPartitionRetryOutcome.js';

/**
 * Delegates observer management calls for one event store and namespace to the Chronicle observer services.
 * Rejections from the kernel propagate unchanged.
 */
export class ObserverOperations {
    private readonly _failedPartitions: FailedPartitions;

    /**
     * Creates a new {@link ObserverOperations} instance.
     * @param _eventStore - Event store name.
     * @param _namespace - Event store namespace.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {
        this._failedPartitions = new FailedPartitions(_eventStore, _namespace, _connection);
    }

    /**
     * Gets the state of an observer on an event sequence.
     * @param observerId - The observer identifier.
     * @param eventSequenceId - The event sequence the observer observes.
     * @returns The reported state.
     */
    async getState(observerId: string, eventSequenceId: string): Promise<ObserverState> {
        const information = await this._connection.observers.getObserverInformation(this.target(observerId, eventSequenceId));
        return {
            id: information.Id,
            eventSequenceId: new EventSequenceId(eventSequenceId),
            runningState: toObserverRunningState(information.RunningState),
            isSubscribed: information.IsSubscribed,
            nextEventSequenceNumber: new EventSequenceNumber(information.NextEventSequenceNumber ?? 0n),
            lastHandledEventSequenceNumber: new EventSequenceNumber(information.LastHandledEventSequenceNumber ?? 0n),
            tailEventSequenceNumber: new EventSequenceNumber(information.TailEventSequenceNumber ?? 0n)
        };
    }

    /**
     * Asks Chronicle to replay an observer.
     * @param observerId - The observer identifier.
     * @param eventSequenceId - The event sequence the observer observes.
     * @returns Whether a replay job was started, and its identifier.
     */
    async replay(observerId: string, eventSequenceId: string): Promise<ObserverReplayResult> {
        const response = await this._connection.observers.replay(this.target(observerId, eventSequenceId));
        return toObserverReplayResult(response.JobId);
    }

    /**
     * Asks Chronicle to retry a failed partition of an observer.
     * @param observerId - The observer identifier.
     * @param eventSequenceId - The event sequence the observer observes.
     * @param partition - The failed partition.
     * @returns The outcome Chronicle reported.
     */
    async retryPartition(observerId: string, eventSequenceId: string, partition: string): Promise<PartitionRetryOutcome> {
        const response = await this._connection.observers.retryPartition({ ...this.target(observerId, eventSequenceId), Partition: partition });
        return toPartitionRetryOutcome(response.Outcome);
    }

    /**
     * Gets the failed partitions of an observer.
     * @param observerId - The observer identifier.
     * @returns The failed partitions.
     */
    getFailedPartitions(observerId: string): Promise<FailedPartition[]> {
        return this._failedPartitions.getFailedPartitionsFor(observerId);
    }

    private target(observerId: string, eventSequenceId: string) {
        return { EventStore: this._eventStore, Namespace: this._namespace, ObserverId: observerId, EventSequenceId: eventSequenceId };
    }
}
