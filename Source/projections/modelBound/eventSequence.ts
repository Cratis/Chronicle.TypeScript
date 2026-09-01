// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { EventSequenceId } from '../../eventSequences/EventSequenceId';

const METADATA_KEY = 'chronicle:projection:eventSequence';

/**
 * Class decorator that overrides the event sequence a model-bound projection reads from.
 * When applied, auto-inbox routing is suppressed - the explicit value is always honored.
 * @param sequence - The event sequence identifier to read from.
 * @returns A class decorator.
 */
export function eventSequence(sequence: string): ClassDecorator {
    return (target: object) => {
        Reflect.defineMetadata(METADATA_KEY, sequence, target);
    };
}

/**
 * Convenience class decorator that pins a model-bound projection to the default event log
 * sequence. Equivalent to `eventSequence(EventSequenceId.eventLog.value)`, but more expressive
 * about the intent to read from the local event log rather than an inbox or another sequence.
 * @param target - The class constructor.
 */
export function eventLog(target: Function): void {
    Reflect.defineMetadata(METADATA_KEY, EventSequenceId.eventLog.value, target);
}

/**
 * Retrieves the explicit event sequence identifier stored on a class, if any.
 * @param target - The class constructor.
 * @returns The event sequence identifier, or undefined when the class has no explicit override.
 */
export function getEventSequenceMetadata(target: Function): string | undefined {
    return Reflect.getMetadata(METADATA_KEY, target);
}
