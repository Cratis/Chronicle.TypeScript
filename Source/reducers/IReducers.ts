// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { FailedPartition } from '../observation/FailedPartition.js';
import type { ObserverReplayResult } from '../observation/ObserverReplayResult.js';
import type { PartitionRetryOutcome } from '../observation/PartitionRetryOutcome.js';
import type { ReducerId } from './ReducerId.js';
import type { ReducerState } from './ReducerState.js';

/**
 * Defines a system to work with reducers, including discovery and registration with the Kernel.
 */
export interface IReducers {
    /**
     * Discovers all reducers from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered reducers with the Chronicle Kernel and starts observation.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;

    /**
     * Gets the state Chronicle reports for a reducer, on the event sequence the reducer declares or was registered for
     * (the event log when the reducer is not known to this client). An unknown reducer reports as not subscribed.
     * @param reducer - A reducer id, id value or decorated class. An undecorated class rejects before any request is sent.
     */
    getStateFor(reducer: ReducerId | string | Constructor): Promise<ReducerState>;

    /**
     * Asks Chronicle to replay a reducer. Resolves with `started: false` when Chronicle did not start a replay job,
     * for example for an unknown or non-replayable reducer. A started job is acceptance, not completion.
     * @param reducer - A reducer id, id value or decorated class.
     */
    replay(reducer: ReducerId | string | Constructor): Promise<ObserverReplayResult>;

    /**
     * Asks Chronicle to retry a failed partition of a reducer and returns the outcome Chronicle reports.
     * {@link PartitionRetryOutcome.Started} means a recovery job was accepted, not that the partition has recovered;
     * observe progress with {@link getFailedPartitionsFor} and {@link getStateFor}. The wire default decodes as
     * `Started`, which Chronicle only sends when it started a job.
     * @param reducer - A reducer id, id value or decorated class.
     * @param partition - The failed partition, usually the event source id.
     */
    retryFailedPartition(reducer: ReducerId | string | Constructor, partition: string): Promise<PartitionRetryOutcome>;

    /**
     * Gets the failed partitions of a reducer.
     * @param reducer - A reducer id, id value or decorated class.
     */
    getFailedPartitionsFor(reducer: ReducerId | string | Constructor): Promise<FailedPartition[]>;
}
