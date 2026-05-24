// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { EventStoreNamespaceName } from '../EventStoreNamespaceName';
import { getEventTypeFor } from '../Events/eventTypeDecorator';
import { ICanSeedEvents } from './ICanSeedEvents';
import { IEventSeeding } from './IEventSeeding';
import { IEventSeedingBuilder } from './IEventSeedingBuilder';
import { IEventSeedingScopeBuilder } from './IEventSeedingScopeBuilder';

interface SeedingEntry {
    readonly eventSourceId: string;
    readonly eventTypeId: string;
    readonly content: string;
    readonly tags: string[];
    readonly isGlobal: boolean;
    readonly targetNamespace: string;
}

/**
 * Implements {@link IEventSeeding}, managing discovery and registration of event seeders
 * with the Chronicle Kernel.
 */
export class EventSeeding implements IEventSeeding {
    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/EventSeeding' });
    private readonly _entries: SeedingEntry[] = [];

    /**
     * Creates a new {@link EventSeeding} instance.
     * @param _eventStoreName - The name of the event store.
     * @param _connection - The Chronicle gRPC connection.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     */
    constructor(
        private readonly _eventStoreName: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider
    ) {}

    /** @inheritdoc */
    for<TEvent extends object>(eventSourceId: string, events: Iterable<TEvent>): IEventSeedingBuilder {
        this.addEntries(eventSourceId, events, true, '');
        return this;
    }

    /** @inheritdoc */
    forEventSource(eventSourceId: string, events: Iterable<object>): IEventSeedingBuilder {
        this.addEntries(eventSourceId, events, true, '');
        return this;
    }

    /** @inheritdoc */
    forNamespace(namespace: string | EventStoreNamespaceName): IEventSeedingScopeBuilder {
        const targetNamespace = typeof namespace === 'string' ? new EventStoreNamespaceName(namespace).value : namespace.value;
        return new EventSeedingScopeBuilder(this, targetNamespace);
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        for (const seederType of this._clientArtifacts.seeders) {
            try {
                const seeder = new (seederType as new () => ICanSeedEvents)();
                await seeder.seed(this);
            } catch (error) {
                this._logger.warn('Failed to activate or execute event seeder - skipping seeder', {
                    seederType: seederType.name,
                    error: String(error)
                });
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._entries.length === 0) {
            return;
        }

        const globalEntries = this._entries.filter(entry => entry.isGlobal);
        const namespacedEntriesByNamespace = this.groupBy(this._entries.filter(entry => !entry.isGlobal), entry => entry.targetNamespace);

        const request = {
            EventStore: this._eventStoreName,
            GlobalByEventType: this.toEventTypeSeedEntries(globalEntries),
            GlobalByEventSource: this.toEventSourceSeedEntries(globalEntries),
            NamespacedEntries: Array.from(namespacedEntriesByNamespace.entries()).map(([namespaceName, entries]) => ({
                Namespace: namespaceName,
                ByEventType: this.toEventTypeSeedEntries(entries),
                ByEventSource: this.toEventSourceSeedEntries(entries)
            }))
        };

        await this._connection.eventSeeding.seed(request);
        this._entries.length = 0;
    }

    addScoped(eventSourceId: string, events: Iterable<object>, targetNamespace: string): void {
        this.addEntries(eventSourceId, events, false, targetNamespace);
    }

    private addEntries<TEvent extends object>(eventSourceId: string, events: Iterable<TEvent>, isGlobal: boolean, targetNamespace: string): void {
        for (const event of events) {
            const eventType = getEventTypeFor(event.constructor as Function);
            this._entries.push({
                eventSourceId,
                eventTypeId: eventType.id.value,
                content: JSON.stringify(event),
                tags: [],
                isGlobal,
                targetNamespace
            });
        }
    }

    private groupBy<TKey extends string, TValue>(
        values: TValue[],
        keySelector: (value: TValue) => TKey
    ): Map<TKey, TValue[]> {
        const grouped = new Map<TKey, TValue[]>();
        for (const value of values) {
            const key = keySelector(value);
            const existing = grouped.get(key);
            if (existing) {
                existing.push(value);
            } else {
                grouped.set(key, [value]);
            }
        }
        return grouped;
    }

    private toEventTypeSeedEntries(entries: SeedingEntry[]): { EventTypeId: string; Entries: object[] }[] {
        const byEventType = this.groupBy(entries, entry => entry.eventTypeId);
        return Array.from(byEventType.entries()).map(([eventTypeId, groupedEntries]) => ({
            EventTypeId: eventTypeId,
            Entries: groupedEntries.map(entry => ({
                EventSourceId: entry.eventSourceId,
                EventTypeId: entry.eventTypeId,
                Content: entry.content,
                Tags: entry.tags
            }))
        }));
    }

    private toEventSourceSeedEntries(entries: SeedingEntry[]): { EventSourceId: string; Entries: object[] }[] {
        const byEventSource = this.groupBy(entries, entry => entry.eventSourceId);
        return Array.from(byEventSource.entries()).map(([eventSourceId, groupedEntries]) => ({
            EventSourceId: eventSourceId,
            Entries: groupedEntries.map(entry => ({
                EventSourceId: entry.eventSourceId,
                EventTypeId: entry.eventTypeId,
                Content: entry.content,
                Tags: entry.tags
            }))
        }));
    }
}

class EventSeedingScopeBuilder implements IEventSeedingScopeBuilder {
    constructor(private readonly _parent: EventSeeding, private readonly _targetNamespace: string) {}

    /** @inheritdoc */
    for<TEvent extends object>(eventSourceId: string, events: Iterable<TEvent>): IEventSeedingScopeBuilder {
        this._parent.addScoped(eventSourceId, events, this._targetNamespace);
        return this;
    }

    /** @inheritdoc */
    forEventSource(eventSourceId: string, events: Iterable<object>): IEventSeedingScopeBuilder {
        this._parent.addScoped(eventSourceId, events, this._targetNamespace);
        return this;
    }
}
