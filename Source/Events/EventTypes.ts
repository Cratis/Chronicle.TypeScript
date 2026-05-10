// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { ChronicleConnection } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { EventTypeId } from './EventTypeId';
import { IEventTypes } from './IEventTypes';
import { getEventTypeMetadata, getEventTypeJsonSchemaFor } from './eventTypeDecorator';

/**
 * Implements {@link IEventTypes}, managing discovery and registration of event types
 * with the Chronicle Kernel.
 */
export class EventTypes implements IEventTypes {
    private readonly _types = new Map<string, Constructor>();

    /**
     * Creates a new {@link EventTypes} instance.
     * @param _eventStore - The name of the event store these types belong to.
     * @param _connection - The connection used to communicate with the Kernel.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    get all(): Constructor[] {
        return [...this._types.values()];
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._types.clear();
        for (const type of this._clientArtifacts.eventTypes) {
            const metadata = getEventTypeMetadata(type);
            if (metadata) {
                this._types.set(metadata.eventType.id.value, type);
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._types.size === 0) {
            await this.discover();
        }

        const registrations = [...this._types.entries()].map(([, type]) => {
            const metadata = getEventTypeMetadata(type)!;
            const schema = getEventTypeJsonSchemaFor(type);
            return {
                Type: {
                    Id: metadata.eventType.id.value,
                    Generation: metadata.eventType.generation.value,
                    Tombstone: false
                },
                Schema: JSON.stringify(schema),
                Generations: [{
                    Generation: metadata.eventType.generation.value,
                    Schema: JSON.stringify(schema)
                }],
                Migrations: [],
                EventStore: this._eventStore
            };
        });

        if (registrations.length === 0) {
            return;
        }

        await this._connection.eventTypes.register({
            EventStore: this._eventStore,
            Types: registrations,
            DisableValidation: false
        });
    }

    /** @inheritdoc */
    hasFor(id: EventTypeId): boolean {
        return this._types.has(id.value);
    }

    /** @inheritdoc */
    getTypeFor(id: EventTypeId): Constructor {
        const type = this._types.get(id.value);
        if (!type) {
            throw new Error(`No event type registered for id '${id.value}'.`);
        }
        return type;
    }
}
