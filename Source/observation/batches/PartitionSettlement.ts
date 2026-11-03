// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationState, type PartitionResult } from '@cratis/chronicle.contracts';
import type { PartitionOutcome } from './PartitionOutcome.js';
import type { PartitionProblem } from './PartitionProblem.js';

/** Sequence number reported when no event of a partition was observed successfully. */
export const SEQUENCE_NUMBER_UNAVAILABLE = 4294967295n;

/**
 * Creates a {@link PartitionProblem} for a failure.
 * @param partition - The partition.
 * @param at - The sequence number of the event it failed at.
 * @param error - What went wrong.
 * @returns The {@link PartitionProblem}.
 */
export function failedAt(partition: string, at: bigint, error: unknown): PartitionProblem {
    return {
        partition, at, state: ObservationState.Failed,
        exceptionMessages: [String(error)],
        exceptionStackTrace: error instanceof Error ? (error.stack ?? '') : '',
        retryAfterMilliseconds: 0
    };
}

/**
 * Settles a partition: it succeeds when no method reported a problem for it, and otherwise settles at its earliest problem.
 * Events before that problem count as observed.
 * @param partition - The partition.
 * @param sequenceNumbers - The sequence numbers of the partition's events, in order.
 * @param problems - The problems reported by any method, for any partition.
 * @returns The {@link PartitionOutcome}.
 */
export function settlePartition(partition: string, sequenceNumbers: readonly bigint[], problems: readonly PartitionProblem[]): PartitionOutcome {
    const earliest = problems
        .filter(problem => problem.partition === partition)
        .reduce<PartitionProblem | undefined>((first, problem) => !first || problem.at < first.at ? problem : first, undefined);
    if (!earliest) {
        return {
            partition, state: ObservationState.Success,
            lastSuccessfulObservation: sequenceNumbers.at(-1) ?? SEQUENCE_NUMBER_UNAVAILABLE,
            exceptionMessages: [], exceptionStackTrace: '', retryAfterMilliseconds: 0
        };
    }
    const handled = sequenceNumbers.filter(sequenceNumber => sequenceNumber < earliest.at);
    return {
        partition, state: earliest.state,
        lastSuccessfulObservation: handled.at(-1) ?? SEQUENCE_NUMBER_UNAVAILABLE,
        exceptionMessages: earliest.exceptionMessages, exceptionStackTrace: earliest.exceptionStackTrace,
        retryAfterMilliseconds: earliest.retryAfterMilliseconds
    };
}

/**
 * Converts a {@link PartitionOutcome} to the {@link PartitionResult} sent to the kernel.
 * @param outcome - The outcome.
 * @returns The {@link PartitionResult}.
 */
export function toPartitionResult(outcome: PartitionOutcome): PartitionResult {
    return {
        Partition: outcome.partition,
        State: outcome.state,
        LastSuccessfulObservation: outcome.lastSuccessfulObservation,
        ExceptionMessages: [...outcome.exceptionMessages],
        ExceptionStackTrace: outcome.exceptionStackTrace,
        RetryAfterMilliseconds: BigInt(Math.max(0, Math.round(outcome.retryAfterMilliseconds))),
        ReadModelState: outcome.readModelState ?? ''
    };
}
