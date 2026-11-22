// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { ReducerId } from './ReducerId.js';
import { getReducerMetadata } from './reducer.js';

/** The observer and event sequence a management call addresses. */
export interface ReducerTarget {
    readonly id: string;
    readonly eventSequenceId: string;
}

function ofType(type: Constructor): ReducerTarget {
    const metadata = getReducerMetadata(type);
    if (!metadata) throw new Error(`'${type.name}' is not a reducer.`);
    return { id: metadata.id.value, eventSequenceId: metadata.eventSequenceId ?? EventSequenceId.eventLog.value };
}

/**
 * Resolves the observer id and event sequence a reducer management call addresses, without mutating any state.
 * Resolution order: a decorated class, a discovered reducer, a known artifact class, then the event log.
 * @param reducer - A reducer id, id value or decorated class.
 * @param discovered - The discovered reducers by id.
 * @param artifacts - The known reducer classes.
 * @returns The target.
 */
export function resolveReducerTarget(reducer: ReducerId | string | Constructor,
    discovered: ReadonlyMap<string, Constructor>, artifacts: readonly Constructor[]): ReducerTarget {
    if (typeof reducer === 'function') return ofType(reducer);
    const id = typeof reducer === 'string' ? reducer : reducer.value;
    const type = discovered.get(id) ?? artifacts.find(candidate => getReducerMetadata(candidate)?.id.value === id);
    return type ? ofType(type) : { id, eventSequenceId: EventSequenceId.eventLog.value };
}
