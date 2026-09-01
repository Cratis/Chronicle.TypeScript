// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverRunningState as ContractObserverRunningState } from '@cratis/chronicle.contracts';
import { ObserverRunningState } from './ObserverRunningState';

/**
 * Converts a wire {@link ContractObserverRunningState} into the client {@link ObserverRunningState}.
 * @param state - The wire running state to convert.
 * @returns The converted client running state.
 */
export function toObserverRunningState(state: ContractObserverRunningState): ObserverRunningState {
    switch (state) {
        case ContractObserverRunningState.Active:
            return ObserverRunningState.Active;
        case ContractObserverRunningState.Suspended:
            return ObserverRunningState.Suspended;
        case ContractObserverRunningState.Replaying:
            return ObserverRunningState.Replaying;
        case ContractObserverRunningState.Disconnected:
            return ObserverRunningState.Disconnected;
        case ContractObserverRunningState.Quarantined:
            return ObserverRunningState.Quarantined;
        default:
            return ObserverRunningState.Unknown;
    }
}
