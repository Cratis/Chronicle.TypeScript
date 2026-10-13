// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FastForwardOutcome as ContractFastForwardOutcome, FastForwardResponse } from '@cratis/chronicle.contracts';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { FastForwardOutcome } from './FastForwardOutcome.js';
import { FastForwardResult } from './FastForwardResult.js';

/**
 * Converts a wire {@link ContractFastForwardOutcome} into the client {@link FastForwardOutcome}.
 * @param outcome - The wire outcome to convert.
 * @returns The converted client outcome.
 */
export function toFastForwardOutcome(outcome: ContractFastForwardOutcome): FastForwardOutcome {
    switch (outcome) {
        case ContractFastForwardOutcome.FastForwarded:
            return FastForwardOutcome.FastForwarded;
        case ContractFastForwardOutcome.AlreadyAtTail:
            return FastForwardOutcome.AlreadyAtTail;
        case ContractFastForwardOutcome.ObserverReplaying:
            return FastForwardOutcome.Replaying;
        case ContractFastForwardOutcome.NotAvailable:
            return FastForwardOutcome.NotAvailable;
        default:
            throw new Error(`Unknown fast forward outcome: ${outcome}`);
    }
}

/**
 * Converts a wire {@link FastForwardResponse} into the client {@link FastForwardResult}.
 * @param response - The wire response to convert.
 * @returns The converted client result.
 */
export function toFastForwardResult(response: FastForwardResponse): FastForwardResult {
    return {
        outcome: toFastForwardOutcome(response.Outcome),
        previousNextEventSequenceNumber: new EventSequenceNumber(response.PreviousNextEventSequenceNumber),
        nextEventSequenceNumber: new EventSequenceNumber(response.NextEventSequenceNumber)
    };
}
