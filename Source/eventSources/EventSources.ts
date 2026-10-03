// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { EventSourceOwner } from '@cratis/chronicle.contracts';
import { ensureCommandSuccess } from '../connection/callResults.js';
import type { EventSourceDefinition } from './EventSourceDefinition.js';
import { getEventSourceMetadata, getEventStreamsFor } from './eventSource.js';
import { DuplicateEventSourceName } from './DuplicateEventSourceName.js';
import { DuplicateEventStreamName } from './DuplicateEventStreamName.js';
import { UnknownEventSource } from './UnknownEventSource.js';
import type { IEventSources } from './IEventSources.js';

/**
 * Implements {@link IEventSources}, discovering `@eventSource` classes and registering them with the Kernel.
 */
export class EventSources implements IEventSources {
    private _byType = new Map<Constructor, EventSourceDefinition>();
    private _byName = new Map<string, EventSourceDefinition>();

    /**
     * Creates a new {@link EventSources}.
     * @param _eventStore - The name of the event store the definitions belong to.
     * @param _connection - The connection used to communicate with the Kernel.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    get all(): ReadonlyArray<EventSourceDefinition> {
        return [...this._byType.values()];
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        const byType = new Map<Constructor, EventSourceDefinition>();
        const byName = new Map<string, EventSourceDefinition>();
        for (const type of this._clientArtifacts.eventSources ?? []) {
            const metadata = getEventSourceMetadata(type);
            if (!metadata) continue;
            if (byName.has(metadata.name)) throw new DuplicateEventSourceName(metadata.name);
            const streams = getEventStreamsFor(type);
            const seen = new Set<string>();
            for (const stream of streams) {
                if (seen.has(stream.name)) throw new DuplicateEventStreamName(metadata.name, stream.name);
                seen.add(stream.name);
            }
            const definition: EventSourceDefinition = {
                type,
                name: metadata.name,
                description: metadata.description,
                concurrency: metadata.concurrency,
                streams: streams.map(stream => ({ ...stream }))
            };
            byType.set(type, definition);
            byName.set(definition.name, definition);
        }
        this._byType = byType;
        this._byName = byName;
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._byType.size === 0) return;
        ensureCommandSuccess('register event sources', await this._connection.eventSources.registerEventSources({
            EventStore: this._eventStore,
            Sources: this.all.map(definition => ({
                Name: definition.name,
                Description: definition.description,
                Owner: EventSourceOwner.Client,
                Concurrency: definition.concurrency,
                Streams: definition.streams.map(stream => ({
                    Name: stream.name,
                    Description: stream.description,
                    Concurrency: stream.concurrency
                }))
            }))
        }));
    }

    /** @inheritdoc */
    getFor(eventSource: Constructor | string): EventSourceDefinition {
        const definition = typeof eventSource === 'string' ? this._byName.get(eventSource) : this._byType.get(eventSource);
        if (!definition) throw new UnknownEventSource(typeof eventSource === 'string' ? eventSource : eventSource.name);
        return definition;
    }
}
