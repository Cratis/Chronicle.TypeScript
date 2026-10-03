// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ConcurrencyDimensionFlags } from './ConcurrencyDimensions.js';
import type { EventSourceDefinition } from './EventSourceDefinition.js';
import type { EventStreamDefinition } from './EventStreamDefinition.js';
import type { IEventSources } from './IEventSources.js';
import { EventRoutingContradictsEventSource } from './EventRoutingContradictsEventSource.js';
import { EventStreamDoesNotBelongToEventSource } from './EventStreamDoesNotBelongToEventSource.js';
import { EventStreamRequiresEventSource } from './EventStreamRequiresEventSource.js';
import { UnknownEventSource } from './UnknownEventSource.js';

/** The explicit routing a caller supplied next to a definition. */
export interface ExplicitRouting {
    /** Explicit event source type, if any. */
    sourceType?: string;

    /** Explicit event stream type, if any. */
    streamType?: string;
}

/** The routing of an append resolved through an event source definition. */
export class ResolvedEventRouting {
    private constructor(readonly definition: EventSourceDefinition, readonly stream?: EventStreamDefinition) {}

    /** The registered event source name written on the event. */
    get eventSource(): string { return this.definition.name; }

    /** The event source type written on the event. */
    get sourceType(): string { return this.definition.name; }

    /** The event stream type to write, or undefined to let the Kernel choose. */
    get streamType(): string | undefined { return this.stream?.name; }

    /** The concurrency dimensions that apply: the stream's when it declares any, otherwise the source's. */
    get dimensions(): ConcurrencyDimensionFlags {
        return this.stream && this.stream.concurrency !== 0 ? this.stream.concurrency : this.definition.concurrency;
    }

    /**
     * Resolves the routing of an append.
     * @param eventSources - The event sources; undefined when the store has none.
     * @param eventSource - The definition class or name; undefined for a legacy append.
     * @param stream - The declared stream name, if any.
     * @param explicit - Explicit routing that must not contradict the definition.
     * @returns The routing, or undefined when no definition is involved.
     * @throws UnknownEventSource, EventStreamDoesNotBelongToEventSource, EventRoutingContradictsEventSource, EventStreamRequiresEventSource.
     */
    static resolve(
        eventSources: IEventSources | undefined,
        eventSource: Constructor | string | undefined,
        stream: string | undefined,
        explicit: ExplicitRouting = {}
    ): ResolvedEventRouting | undefined {
        if (eventSource === undefined) {
            if (stream !== undefined) throw new EventStreamRequiresEventSource(stream);
            return undefined;
        }
        if (!eventSources) throw new UnknownEventSource(typeof eventSource === 'string' ? eventSource : eventSource.name);
        const definition = eventSources.getFor(eventSource);

        const isSet = (value: string | undefined, unspecified: string[]) => value !== undefined && value !== '' && !unspecified.includes(value);
        if (isSet(explicit.sourceType, ['Default', 'Unspecified']) && explicit.sourceType !== definition.name) {
            throw new EventRoutingContradictsEventSource(definition.name, 'event source type', definition.name, explicit.sourceType!);
        }
        const explicitStream = isSet(explicit.streamType, ['All']) ? explicit.streamType : undefined;
        if (stream !== undefined && explicitStream !== undefined && stream !== explicitStream) {
            throw new EventRoutingContradictsEventSource(definition.name, 'event stream type', stream, explicitStream);
        }

        const name = stream ?? explicitStream;
        if (name === undefined) return new ResolvedEventRouting(definition);
        const found = definition.streams.find(candidate => candidate.name === name);
        if (!found) throw new EventStreamDoesNotBelongToEventSource(definition.name, name);
        return new ResolvedEventRouting(definition, found);
    }
}
