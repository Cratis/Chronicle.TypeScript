// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendResult } from './AppendResult.js';
import type { ConstraintViolation } from './ConstraintViolation.js';
import type { WaitForCompletionOptions } from './WaitForCompletionOptions.js';
import type { WaitForCompletionResult } from './WaitForCompletionResult.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';

/** Map the wire append response for both the connected client and in-process scenarios. */
export function createAppendResult(
    sequenceNumber: bigint,
    constraintViolations: Array<{ ConstraintId?: string; Message?: string; Details?: Record<string, string> }>,
    errors: string[],
    concurrencyViolation: { EventSourceId?: string; ExpectedSequenceNumber?: bigint; ActualSequenceNumber?: bigint } | undefined,
    resolveMessage: ((violation: ConstraintViolation) => ConstraintViolation) | undefined,
    wait: (sequence: EventSequenceNumber, succeeded: boolean, options?: number | WaitForCompletionOptions) => Promise<WaitForCompletionResult>
): AppendResult {
    const mappedViolations = constraintViolations.map(violation => {
        const mapped = {
            constraintId: violation.ConstraintId ?? '',
            message: violation.Message ?? '',
            details: violation.Details ?? {}
        };
        return resolveMessage?.(mapped) ?? mapped;
    });
    const mappedErrors = errors.map(message => ({ message }));
    const mappedConcurrencyViolation = concurrencyViolation ? {
        eventSourceId: concurrencyViolation.EventSourceId ?? '',
        expectedSequenceNumber: new EventSequenceNumber(concurrencyViolation.ExpectedSequenceNumber ?? 0n),
        actualSequenceNumber: new EventSequenceNumber(concurrencyViolation.ActualSequenceNumber ?? 0n)
    } : undefined;
    const eventSequenceNumber = new EventSequenceNumber(sequenceNumber === 18446744073709551615n ? 0n : sequenceNumber);
    const isSuccess = mappedViolations.length === 0 && mappedErrors.length === 0 && !mappedConcurrencyViolation;
    return {
        sequenceNumber: eventSequenceNumber,
        constraintViolations: mappedViolations,
        concurrencyViolation: mappedConcurrencyViolation,
        errors: mappedErrors,
        isSuccess,
        waitForCompletion: (options?: number | WaitForCompletionOptions) => wait(eventSequenceNumber, isSuccess, options)
    };
}
