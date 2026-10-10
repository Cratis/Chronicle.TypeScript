// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationState, ReducerMessage } from '@cratis/chronicle.contracts';
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

    /** Creates the result message reported back to the kernel. */
    toMessage(partition: string): ReducerMessage {
        const readModelState = this.state === ObservationState.Success && this.currentState !== undefined
            ? JSON.stringify(this.currentState)
            : undefined;

        return {
            Content: {
                Value0: undefined,
                Value1: {
                    Partition: partition,
                    State: this.state,
                    LastSuccessfulObservation: this.lastSuccessfullyObservedEvent,
                    ExceptionMessages: this.exceptionMessages,
                    ExceptionStackTrace: this.exceptionStackTrace,
                    ReadModelState: readModelState ?? ''
                }
            }
        };
    }
}
