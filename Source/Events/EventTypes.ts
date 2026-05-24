// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { EventTypeId } from './EventTypeId';
import { IEventTypes } from './IEventTypes';
import { getEventTypeMetadata, getEventTypeJsonSchemaFor } from './eventTypeDecorator';
import { EventMigrationBuilder } from './Migrations/EventMigrationBuilder';
import { EventTypeMigrators } from './Migrations/EventTypeMigrators';
import { getEventTypeMigrationMetadata } from './Migrations/eventTypeMigration';
import { IEventTypeMigration } from './Migrations/IEventTypeMigration';

/**
 * Implements {@link IEventTypes}, managing discovery and registration of event types
 * with the Chronicle Kernel.
 */
export class EventTypes implements IEventTypes {
    private readonly _typesByGeneration = new Map<string, Constructor>();
    private readonly _latestTypes = new Map<string, Constructor>();
    private readonly _eventTypeMigrators: EventTypeMigrators;

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
    ) {
        this._eventTypeMigrators = new EventTypeMigrators(_clientArtifacts);
    }

    /** @inheritdoc */
    get all(): Constructor[] {
        return [...this._latestTypes.values()];
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._typesByGeneration.clear();
        this._latestTypes.clear();
        for (const type of this._clientArtifacts.eventTypes) {
            const metadata = getEventTypeMetadata(type);
            if (metadata) {
                const key = metadata.eventType.toString();
                this._typesByGeneration.set(key, type);
                const existing = this._latestTypes.get(metadata.eventType.id.value);
                if (!existing) {
                    this._latestTypes.set(metadata.eventType.id.value, type);
                    continue;
                }

                const existingMetadata = getEventTypeMetadata(existing);
                if (!existingMetadata || existingMetadata.eventType.generation.value < metadata.eventType.generation.value) {
                    this._latestTypes.set(metadata.eventType.id.value, type);
                }
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._typesByGeneration.size === 0) {
            await this.discover();
        }

        const groupedById = new Map<string, Constructor[]>();
        for (const type of this._typesByGeneration.values()) {
            const metadata = getEventTypeMetadata(type);
            if (!metadata) {
                continue;
            }

            const existing = groupedById.get(metadata.eventType.id.value) ?? [];
            existing.push(type);
            groupedById.set(metadata.eventType.id.value, existing);
        }

        const registrations = Array.from(groupedById.values()).map(group => {
            const sorted = group
                .map(type => ({ type, metadata: getEventTypeMetadata(type)! }))
                .sort((a, b) => a.metadata.eventType.generation.value - b.metadata.eventType.generation.value);
            const latest = sorted[sorted.length - 1];
            const registration = {
                Type: {
                    Id: latest.metadata.eventType.id.value,
                    Generation: latest.metadata.eventType.generation.value,
                    Tombstone: latest.metadata.eventType.tombstone
                },
                Schema: JSON.stringify(getEventTypeJsonSchemaFor(latest.type)),
                Generations: sorted.map(({ type, metadata }) => ({
                    Generation: metadata.eventType.generation.value,
                    Schema: JSON.stringify(getEventTypeJsonSchemaFor(type))
                })),
                Migrations: [] as {
                    FromGeneration: number;
                    ToGeneration: number;
                    UpcastJmesPath: string;
                    DowncastJmesPath: string;
                }[],
                EventStore: this._eventStore
            };

            for (const { type } of sorted) {
                const migratorTypes = this._eventTypeMigrators.getMigratorsFor(type);
                for (const migratorType of migratorTypes) {
                    const metadata = getEventTypeMigrationMetadata(migratorType);
                    if (!metadata) {
                        continue;
                    }

                    const migrator = new (migratorType as Constructor<IEventTypeMigration>)();
                    const upcastBuilder = new EventMigrationBuilder<unknown, unknown>();
                    migrator.upcast(upcastBuilder);

                    const downcastBuilder = new EventMigrationBuilder<unknown, unknown>();
                    migrator.downcast(downcastBuilder);

                    registration.Migrations.push({
                        FromGeneration: metadata.previousEventType.generation.value,
                        ToGeneration: metadata.eventType.generation.value,
                        UpcastJmesPath: JSON.stringify(upcastBuilder.toObject()),
                        DowncastJmesPath: JSON.stringify(downcastBuilder.toObject())
                    });

                    if (!registration.Generations.some(_ => _.Generation === metadata.previousEventType.generation.value)) {
                        registration.Generations.push({
                            Generation: metadata.previousEventType.generation.value,
                            Schema: '{}'
                        });
                    }
                    if (!registration.Generations.some(_ => _.Generation === metadata.eventType.generation.value)) {
                        registration.Generations.push({
                            Generation: metadata.eventType.generation.value,
                            Schema: '{}'
                        });
                    }
                }
            }

            return registration;
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
        return this._latestTypes.has(id.value);
    }

    /** @inheritdoc */
    getTypeFor(id: EventTypeId): Constructor {
        const type = this._latestTypes.get(id.value);
        if (!type) {
            throw new Error(`No event type registered for id '${id.value}'.`);
        }
        return type;
    }
}
