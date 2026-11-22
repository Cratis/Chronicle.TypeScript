// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { IReactorBuilder } from './IReactorBuilder.js';
import type { IReactorDefinitionBuilder } from './IReactorDefinitionBuilder.js';
import type { IReactorDefinition } from './IReactorDefinition.js';
import type { Constructor } from '@cratis/fundamentals';
import type { FailedPartition } from '../observation/FailedPartition.js';
import type { ObserverReplayResult } from '../observation/ObserverReplayResult.js';
import type { PartitionRetryOutcome } from '../observation/PartitionRetryOutcome.js';
import type { ReactorId } from './ReactorId.js';
import type { ReactorState } from './ReactorState.js';
import type { WaitTillSubscribedOptions } from './WaitTillSubscribedOptions.js';

/** Manages reactor identities and their local observations for one event store and namespace. */
export interface IReactors {
    /** Discovers artifacts, rejecting duplicate IDs before any stream is opened. */
    discover(): Promise<void>;

    /** Creates an immutable definition without registering or observing it. */
    define(id: ReactorId | string, define: (builder: IReactorBuilder) => void): IReactorDefinition;

    /** Starts local observation for discovered and retained runtime definitions. Idempotent while active. */
    register(): Promise<void>;
    /** Resolves after local validation, reservation and observation start, not a kernel acknowledgment. */
    register(definition: IReactorDefinition): Promise<void>;
    register(id: ReactorId | string, define: (builder: IReactorBuilder) => void): Promise<void>;
    /** The callback receives the envelope and the observation's cancellation signal. */
    register(id: ReactorId | string, configure: (builder: IReactorDefinitionBuilder) => void, handle: IReactorDefinition['handle']): Promise<void>;

    /** Removes local restoration eligibility and cancels observation; does not wait for in-flight callbacks. */
    unregister(id: ReactorId | string): Promise<void>;

    /**
     * Polls observer information until IsSubscribed, independently of registration.
     * This is not a causal acknowledgment of a particular register call and may observe an existing subscription.
     */
    waitTillSubscribed(id: ReactorId | string, options?: WaitTillSubscribedOptions): Promise<void>;

    /**
     * Gets the state Chronicle reports for a reactor, on the event sequence the reactor declares or was registered for
     * (the event log when the reactor is not known to this client). An unknown reactor reports as not subscribed.
     * @param reactor - A reactor id, id value or decorated class. An undecorated class rejects before any request is sent.
     */
    getStateFor(reactor: ReactorId | string | Constructor): Promise<ReactorState>;

    /**
     * Asks Chronicle to replay a reactor. Resolves with `started: false` when Chronicle did not start a replay job,
     * for example for an unknown or non-replayable reactor. A started job is acceptance, not completion.
     * @param reactor - A reactor id, id value or decorated class.
     */
    replay(reactor: ReactorId | string | Constructor): Promise<ObserverReplayResult>;

    /**
     * Asks Chronicle to retry a failed partition of a reactor and returns the outcome Chronicle reports.
     * {@link PartitionRetryOutcome.Started} means a recovery job was accepted, not that the partition has recovered;
     * observe progress with {@link getFailedPartitionsFor} and {@link getStateFor}. The wire default decodes as
     * `Started`, which Chronicle only sends when it started a job.
     * @param reactor - A reactor id, id value or decorated class.
     * @param partition - The failed partition, usually the event source id.
     */
    retryFailedPartition(reactor: ReactorId | string | Constructor, partition: string): Promise<PartitionRetryOutcome>;

    /**
     * Gets the failed partitions of a reactor.
     * @param reactor - A reactor id, id value or decorated class.
     */
    getFailedPartitionsFor(reactor: ReactorId | string | Constructor): Promise<FailedPartition[]>;
}
