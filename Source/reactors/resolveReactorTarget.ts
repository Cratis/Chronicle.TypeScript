// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { ReactorId } from './ReactorId.js';
import type { ReactorRegistration } from './ReactorRegistration.js';
import { ReactorRegistrationKind } from './ReactorRegistrationKind.js';
import { getReactorMetadata } from './reactor.js';

/** The observer and event sequence a management call addresses. */
export interface ReactorTarget {
    readonly id: string;
    readonly eventSequenceId: string;
}

function sequenceOf(type: Constructor): string {
    return getReactorMetadata(type)?.eventSequenceId ?? EventSequenceId.eventLog.value;
}

function ofType(type: Constructor): ReactorTarget {
    const metadata = getReactorMetadata(type);
    if (!metadata) throw new Error(`'${type.name}' is not a reactor.`);
    return { id: metadata.id.value, eventSequenceId: sequenceOf(type) };
}

function ofRegistration(registration: ReactorRegistration): ReactorTarget {
    const eventSequenceId = registration.kind === ReactorRegistrationKind.Discovered
        ? sequenceOf(registration.type)
        : registration.definition.eventSequenceId.value;
    return { id: registration.id, eventSequenceId };
}

/**
 * Resolves the observer id and event sequence a reactor management call addresses, without mutating any state.
 * Resolution order: a decorated class, a current registration, a known artifact class, then the event log.
 * @param reactor - A reactor id, id value or decorated class.
 * @param registrations - The current registrations.
 * @param artifacts - The known reactor classes.
 * @returns The target.
 */
export function resolveReactorTarget(reactor: ReactorId | string | Constructor,
    registrations: readonly ReactorRegistration[], artifacts: readonly Constructor[]): ReactorTarget {
    if (typeof reactor === 'function') return ofType(reactor);
    const id = typeof reactor === 'string' ? reactor : reactor.value;
    const registration = registrations.find(entry => entry.id === id);
    if (registration) return ofRegistration(registration);
    const type = artifacts.find(candidate => getReactorMetadata(candidate)?.id.value === id);
    return type ? ofType(type) : { id, eventSequenceId: EventSequenceId.eventLog.value };
}
