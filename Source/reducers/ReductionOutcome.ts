// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationState, type PartitionResult, type ReducerMessage } from '@cratis/chronicle.contracts';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';

/** Sentinel sequence number sent back when no event was successfully processed. */
export const SEQUENCE_NUMBER_UNAVAILABLE = 4294967295n;

const stackOf = (error: unknown): string => error instanceof Error ? (error.stack ?? '') : '';

/**
 * Accumulates the result of reducing one reduce operation: the state, the failure details and the
 * last event that was successfully reduced.
 */
export class ReductionOutcome {
    state = ObservationState.Success;
    lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
    readonly exceptionMessages: string[] = [];
    exceptionStackTrace = '';
    retryAfterMilliseconds = 0;
    currentState: unknown;

    /** Gets whether the reduction has failed. */
    get failed(): boolean {
        return this.state === ObservationState.Failed;
    }

    /** Records a failure of the reduction. */
    recordFailure(error: unknown): void {
        this.exceptionMessages.push(String(error));
        this.exceptionStackTrace = stackOf(error);
        this.state = ObservationState.Failed;
    }

    /**
     * Records that a batch method deferred the reduction: nothing is written, and the event source is delivered again later.
     * @param retryAfterMilliseconds - How long to wait before delivering again.
     */
    recordDeferral(retryAfterMilliseconds: number): void {
        this.state = ObservationState.Deferred;
        this.lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
        this.retryAfterMilliseconds = retryAfterMilliseconds;
    }

    /**
     * Copies the result of another outcome, such as a failed replay notification shared by every event source of a page.
     * @param other - The outcome to copy.
     */
    copyFrom(other: ReductionOutcome): void {
        this.state = other.state;
        this.lastSuccessfullyObservedEvent = other.lastSuccessfullyObservedEvent;
        this.exceptionMessages.push(...other.exceptionMessages);
        this.exceptionStackTrace = other.exceptionStackTrace;
    }

    /** Records a failure to notify of a replay lifecycle transition. */
    recordReplayNotificationFailure(error: unknown): void {
        if (error instanceof ArtifactCompletionFailed && error.processingError !== undefined) {
            this.exceptionMessages.push(String(error.processingError));
        }
        this.recordFailure(error);
    }

    /** Records a failure to activate the reducer or to complete its activation. */
    recordActivationFailure(error: unknown): void {
        this.exceptionMessages.push(String(error));
        const completionStack = stackOf(error);
        this.exceptionStackTrace = error instanceof ArtifactCompletionFailed && this.exceptionStackTrace
            ? `${this.exceptionStackTrace}\n${completionStack}` : completionStack;
        this.state = ObservationState.Failed;
        if (error instanceof ArtifactCompletionFailed) {
            this.lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
        }
    }

    /** The read model state as JSON, or an empty string when there is nothing to write. */
    get readModelState(): string {
        return this.state === ObservationState.Success && this.currentState !== undefined
            ? JSON.stringify(this.currentState)
            : '';
    }

    /**
     * Creates the result for one event source of a page.
     * @param partition - The partition (event source).
     * @returns The {@link PartitionResult}.
     */
    toPartitionResult(partition: string): PartitionResult {
        return {
            Partition: partition,
            State: this.state,
            LastSuccessfulObservation: this.lastSuccessfullyObservedEvent,
            ExceptionMessages: this.exceptionMessages,
            ExceptionStackTrace: this.exceptionStackTrace,
            RetryAfterMilliseconds: BigInt(Math.max(0, Math.round(this.retryAfterMilliseconds))),
            ReadModelState: this.readModelState
        };
    }

    /**
     * Creates the legacy single-partition result message reported back to a kernel that does not deliver pages.
     * @param partition - The partition (event source).
     * @param deliveryId - The delivery identifier to echo.
     * @returns The {@link ReducerMessage}.
     */
    toMessage(partition: string, deliveryId: bigint = 0n): ReducerMessage {
        return {
            Content: {
                Value0: undefined,
                Value1: {
                    Partition: partition,
                    State: this.state === ObservationState.Deferred ? ObservationState.Failed : this.state,
                    LastSuccessfulObservation: this.lastSuccessfullyObservedEvent,
                    ExceptionMessages: this.exceptionMessages,
                    ExceptionStackTrace: this.exceptionStackTrace,
                    ReadModelState: this.readModelState,
                    DeliveryId: deliveryId,
                    RetryAfterMilliseconds: 0n,
                    Partitions: []
                }
            }
        };
    }
}
