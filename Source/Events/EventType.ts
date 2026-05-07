// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventTypeId } from './EventTypeId';
import { EventTypeGeneration } from './EventTypeGeneration';

/**
 * Represents the type of an event.
 */
export class EventType {
    /** Represents an unknown event type. */
    static readonly unknown = new EventType(EventTypeId.unknown, EventTypeGeneration.first, false);

    constructor(
        readonly id: EventTypeId,
        readonly generation: EventTypeGeneration,
        readonly tombstone: boolean = false
    ) {}

    /** @inheritdoc */
    toString(): string {
        return `${this.id.value}+${this.generation.value}`;
    }

    /**
     * Parse from a string representation of event type to actual type.
     * The expected format is guid+generation. Ex: aa7faa25-afc1-48d1-8558-716581c0e916+1.
     * @param input - The string representation to parse.
     * @returns The parsed EventType.
     */
    static parse(input: string): EventType {
        const segments = input.split('+');
        if (segments.length === 1) {
            return new EventType(new EventTypeId(segments[0]), EventTypeGeneration.first, false);
        }
        if (segments.length === 2) {
            return new EventType(new EventTypeId(segments[0]), new EventTypeGeneration(parseInt(segments[1], 10)), false);
        }
        return new EventType(new EventTypeId(segments[0]), new EventTypeGeneration(parseInt(segments[1], 10)), segments[2] === 'true');
    }
}
