// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverRemovalOutcome as ContractObserverRemovalOutcome, RemoveObserverResponse } from '@cratis/chronicle.contracts';
import { ObserverRemovalOutcome } from './ObserverRemovalOutcome.js';
import { ObserverRemovalResult } from './ObserverRemovalResult.js';

/**
 * Converts a wire {@link ContractObserverRemovalOutcome} into the client {@link ObserverRemovalOutcome}.
 * @param outcome - The wire outcome to convert.
 * @returns The converted client outcome.
 */
export function toObserverRemovalOutcome(outcome: ContractObserverRemovalOutcome): ObserverRemovalOutcome {
    switch (outcome) {
        case ContractObserverRemovalOutcome.Removed:
            return ObserverRemovalOutcome.Removed;
        case ContractObserverRemovalOutcome.ObserverNotFound:
            return ObserverRemovalOutcome.ObserverNotFound;
        case ContractObserverRemovalOutcome.ObserverActive:
            return ObserverRemovalOutcome.ObserverActive;
        case ContractObserverRemovalOutcome.ObserverSubscribed:
            return ObserverRemovalOutcome.ObserverSubscribed;
        default:
            throw new Error(`Unknown observer removal outcome: ${outcome}`);
    }
}

/**
 * Converts a wire {@link RemoveObserverResponse} into the client {@link ObserverRemovalResult}.
 * @param response - The wire response to convert.
 * @returns The converted client removal result.
 */
export function toObserverRemovalResult(response: RemoveObserverResponse): ObserverRemovalResult {
    const outcome = toObserverRemovalOutcome(response.Outcome);
    return {
        outcome,
        blockingNamespace: response.BlockingNamespace ?? '',
        isRemoved: outcome === ObserverRemovalOutcome.Removed
    };
}
