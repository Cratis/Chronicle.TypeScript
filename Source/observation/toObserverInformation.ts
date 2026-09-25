// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverInformation as ContractObserverInformation, ObserverType as ContractObserverType } from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { ObserverInformation } from './ObserverInformation.js';
import { ObserverType } from './ObserverType.js';
import { toObserverRunningState } from './toObserverRunningState.js';

/**
 * Converts a wire {@link ContractObserverType} into the client {@link ObserverType}.
 * @param type - The wire observer type to convert.
 * @returns The converted client observer type.
 */
export function toObserverType(type: ContractObserverType): ObserverType {
    switch (type) {
        case ContractObserverType.Reactor:
            return ObserverType.Reactor;
        case ContractObserverType.Projection:
            return ObserverType.Projection;
        case ContractObserverType.Reducer:
            return ObserverType.Reducer;
        case ContractObserverType.External:
            return ObserverType.External;
        default:
            return ObserverType.Unknown;
    }
}

/**
 * Converts a wire {@link ContractObserverInformation} into the client {@link ObserverInformation}.
 * @param observer - The wire observer information to convert.
 * @returns The converted client observer information.
 */
export function toObserverInformation(observer: ContractObserverInformation): ObserverInformation {
    return {
        id: observer.Id,
        eventSequenceId: new EventSequenceId(observer.EventSequenceId),
        type: toObserverType(observer.Type),
        runningState: toObserverRunningState(observer.RunningState),
        lastHandledEventSequenceNumber: new EventSequenceNumber(observer.LastHandledEventSequenceNumber ?? 0n),
        nextEventSequenceNumber: new EventSequenceNumber(observer.NextEventSequenceNumber ?? 0n),
        handledEventCount: observer.HandledEventCount ?? 0n
    };
}
