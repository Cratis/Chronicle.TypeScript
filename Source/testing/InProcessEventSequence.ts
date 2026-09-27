// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { EventObservationState } from '@cratis/chronicle.contracts';
import { AppendOperationsBroadcaster } from '../eventSequences/AppendOperationsBroadcaster.js';
import { prepareBatchAppend } from '../eventSequences/prepareBatchAppend.js';
import { Guid, type Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata, getEventTypeFor } from '../events/eventTypeDecorator.js';
import { getTagsFor } from '../events/tagDecorator.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import { Tag } from '../events/Tag.js';
import { EventType } from '../events/EventType.js';
import { EventTypeId } from '../events/EventTypeId.js';
import { EventTypeGeneration } from '../events/EventTypeGeneration.js';
import { Identity } from '../identity/Identity.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { AppendedEventWithResult } from '../eventSequences/AppendedEventWithResult.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { IEventSequence } from '../eventSequences/IEventSequence.js';
import type { ITransactionalEventSequence } from '../eventSequences/ITransactionalEventSequence.js';
import type { CompleteStreamResult } from '../eventSequences/CompleteStreamResult.js';
import { prepareSingleAppend } from '../eventSequences/prepareSingleAppend.js';
import { toContractsGuid } from '../connection/Guid.js';
import { getUniqueEventMetadata, getUniquePropertyMetadata } from '../events/constraints/unique.js';
import { getRemovedConstraintNames } from '../events/constraints/removeConstraint.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

// JS trim() omits U+0085, which the kernel trims. Reject unproven non-ASCII whitespace and controls.
const unprovenFilterCharacters = /[\u007f-\u009f]|(?=[^\x00-\x7f])\p{White_Space}/u;

/** Fixture-backed, scenario-local append sequence; no kernel or observer scheduler is started. */
export class InProcessEventSequence implements IEventSequence {
    readonly id: EventSequenceId;
    private readonly _catalog = new Map<Function, ReturnType<typeof getEventTypeMetadata>>();
    private readonly _history: AppendedEvent[] = [];
    private readonly _store: string;
    private readonly _namespace: string;
    private readonly _clock: () => Date;
    private readonly _correlationId?: () => string;
    private _setup = false;
    private _allowSeedAppend = false;
    private _stagedSeeds?: AppendedEvent[];
    private _stagedNotifications?: AppendedEventWithResult[][];
    private _busy = false;
    private readonly _results: AppendResult[] = [];
    readonly appendOperations = new AppendOperationsBroadcaster<AppendedEventWithResult[]>();

    constructor(options: EventScenarioOptions, eventTypes: Constructor[]) {
        if (options.eventSequenceId && options.eventSequenceId.value !== EventSequenceId.eventLog.value) {
            throw this.unsupported('options.eventSequenceId', options.eventSequenceId.value, 'Custom sequences are not fixture-backed.');
        }
        this.id = options.eventSequenceId ?? EventSequenceId.eventLog;
        if (options.eventStore !== undefined && options.eventStore !== 'test-event-store') {
            throw this.unsupported('options.eventStore', options.eventStore, 'Custom event stores are not fixture-backed.');
        }
        if (options.namespace !== undefined && options.namespace !== 'default') {
            throw this.unsupported('options.namespace', options.namespace, 'Custom namespaces are not fixture-backed.');
        }
        this._store = options.eventStore ?? 'test-event-store';
        this._namespace = options.namespace ?? 'default';
        this._clock = options.clock ?? (() => new Date());
        this._correlationId = options.correlationId;
        const ids = new Set<string>();
        for (const type of eventTypes) {
            const metadata = getEventTypeMetadata(type);
            if (!metadata) throw this.unsupported('artifacts.eventTypes', type.name, 'Event type has no @eventType metadata.');
            const eventType = metadata.eventType;
            if (!eventType.id.value.trim() || eventType.id.value !== eventType.id.value.trim() ||
                unprovenFilterCharacters.test(eventType.id.value) || eventType.id.value.includes(',')) {
                throw this.unsupported('artifacts.eventTypes.id', eventType.id.value, 'Comma-separated or padded event IDs have unproven filter behavior.');
            }
            if (ids.has(eventType.id.value)) throw this.unsupported('artifacts.eventTypes', type.name, 'Duplicate event ID or generation history.');
            ids.add(eventType.id.value);
            if (eventType.generation.value !== 1 || eventType.tombstone) {
                throw this.unsupported('artifacts.eventTypes', type.name, 'Only generation 1, non-tombstone events are proven.');
            }
            if (options.constraints !== 'disabled' && (getUniqueEventMetadata(type) || getRemovedConstraintNames(type).length ||
                [...metadata.members.keys()].some(key => getUniquePropertyMetadata(type, key)))) {
                throw this.unsupported('artifacts.eventTypes.constraints', type.name, 'Constraint metadata is not supported in this increment.');
            }
            if (getTagsFor(type).length) throw this.unsupported('artifacts.eventTypes.tags', type.name, 'Tagged events are not fixture-backed.');
            // Validate the complete schema, not only properties present on a particular event.
            const schema = metadata.schema;
            if (schema.type !== 'object' || schema.compliance?.length || schema.security?.length ||
                schema.enum !== undefined || schema.items !== undefined || schema.format !== undefined ||
                schema.additionalProperties !== false ||
                schema.required?.length !== Object.keys(schema.properties ?? {}).length ||
                !schema.properties || Object.keys(schema.properties).length === 0 ||
                Object.entries(schema.properties).some(([key, property]) =>
                    !/^[a-z][a-zA-Z0-9]*$/.test(key) || !['string', 'boolean'].includes(property.type ?? '') ||
                    property.format !== undefined || property.compliance?.length || property.security?.length ||
                    property.items !== undefined || property.properties !== undefined || property.enum !== undefined ||
                    property.additionalProperties !== undefined)) {
                throw this.unsupported('artifacts.eventTypes.schema', type.name, 'Only flat, unclassified string/boolean fields are fixture-backed.');
            }
            this._catalog.set(type, metadata);
        }
    }

    get results(): readonly AppendResult[] { return Object.freeze([...this._results]); }
    get appendedEvents(): readonly AppendedEvent[] { return Object.freeze(this._history.map(event => this.snapshot(event))); }

    /** Stage every single append before committing setup history or publishing notifications. */
    async seed(source: string, events: object[]): Promise<void> {
        if (this._setup || this._busy) throw this.unsupported('given.events', this.id.value, 'Overlapping setup calls are not fixture-backed.');
        this._setup = true;
        this._stagedSeeds = [];
        this._stagedNotifications = [];
        try {
            for (const event of events) {
                this._allowSeedAppend = true;
                let pending: Promise<AppendResult>;
                try { pending = this.append(source, event); }
                finally { this._allowSeedAppend = false; }
                const result = await pending;
                if (!result.isSuccess) throw new Error(`EventScenario given setup failed: ${JSON.stringify(result)}`);
            }
            this._history.push(...this._stagedSeeds);
            for (const notification of this._stagedNotifications) this.appendOperations.publish(notification);
        } finally {
            this._stagedSeeds = undefined;
            this._stagedNotifications = undefined;
            this._setup = false;
        }
    }

    get transactional(): ITransactionalEventSequence { throw this.unsupported('transactional', this.id.value, 'Transactions require a kernel.'); }

    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        if (this._busy || (this._setup && !this._allowSeedAppend)) {
            throw this.unsupported('append', this.id.value, 'Overlapping calls do not have proven ordering.');
        }
        this._busy = true;
        try {
            if (!event || typeof event !== 'object') throw this.unsupported('append.event', this.id.value, 'Only registered event instances are supported.');
            if (!/^[A-Za-z0-9_-]+$/.test(eventSourceId)) throw this.unsupported('append.source', eventSourceId, 'Only simple source identifiers are fixture-backed.');
            if (options && (Reflect.ownKeys(options).length || options.correlationId !== undefined || options.sourceType !== undefined ||
                options.streamType !== undefined || options.streamId !== undefined || options.subject !== undefined ||
                options.occurred !== undefined || options.eventSourceId !== undefined || options.concurrencyScope !== undefined ||
                options.tags !== undefined || options.concurrencyScopes !== undefined)) {
                throw this.unsupported('append.options', event.constructor.name, 'Append metadata, routing and concurrency are not fixture-backed.');
            }
            const metadata = this._catalog.get(event.constructor);
            if (!metadata) throw this.unsupported('append.event', event.constructor.name, 'Event is not in the selected, validated catalog.');
            let prepared: ReturnType<typeof prepareSingleAppend>;
            let content: Record<string, unknown>;
            try {
                prepared = prepareSingleAppend(event, this._correlationId ? { correlationId: this._correlationId() } : undefined);
                content = JSON.parse(prepared.content) as Record<string, unknown>;
            } catch (error) {
                throw this.unsupported('append.serialization', event.constructor.name, `Payload or metadata could not be serialized: ${String(error)}.`);
            }
            try {
                toContractsGuid(prepared.correlationId);
                if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(prepared.correlationId.toString())) throw new Error('Invalid correlation ID.');
            } catch {
                throw this.unsupported('append.correlationId', event.constructor.name, 'Correlation ID must be a valid GUID.');
            }
            if (prepared.identity !== Identity.system || prepared.causationChain.length !== 2 ||
                Object.keys(prepared.causationChain[0].properties).length !== 0) {
                throw this.unsupported('append.context', event.constructor.name, 'Ambient identity or causation metadata is not fixture-backed.');
            }
            const properties = metadata.schema.properties!;
            if (!content || typeof content !== 'object' || Array.isArray(content) ||
                Object.keys(content).length !== Object.keys(properties).length ||
                Object.entries(properties).some(([key, property]) => typeof content[key] !== property.type ||
                    (property.type === 'string' && !/^[\x20-\x21\x23-\x5b\x5d-\x7e\u00e9]*$/.test(content[key] as string)))) {
                throw this.unsupported('append.content', event.constructor.name, 'Content differs from the flat scalar schema; null, missing and extra values are not proven.');
            }
            const occurred = this._clock();
            // Date has millisecond precision; only the UTC year range representable by DateTimeOffset is supported.
            if (!(occurred instanceof Date) || Number.isNaN(occurred.getTime()) ||
                occurred.getUTCFullYear() < 1 || occurred.getUTCFullYear() > 9999) {
                throw this.unsupported('append.clock', event.constructor.name, 'Clock must return a valid Date within UTC years 1–9999 (millisecond precision).');
            }
            const canonical = Object.fromEntries(Object.entries(content).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
            const hash = createHash('sha256').update(`${prepared.eventType.id.value}|${eventSourceId}|${JSON.stringify(canonical)}`).digest('base64');
            const sequenceNumber = new EventSequenceNumber(BigInt(this._history.length + (this._stagedSeeds?.length ?? 0)));
            const stored: AppendedEvent = {
                eventType: prepared.eventType,
                content,
                context: {
                    eventStore: this._store, namespace: this._namespace,
                    sequenceNumber: sequenceNumber.value, eventSourceId,
                    eventSourceType: 'Default', eventStreamType: 'All', eventStreamId: 'Default',
                    subject: eventSourceId, hash, causedBy: prepared.identity, observationState: EventObservationState.Initial,
                    eventType: prepared.eventType, occurred, correlationId: prepared.correlationId.toString(),
                    causation: prepared.causationChain.map(item => ({ type: item.type.name, occurred: item.occurred, properties: { ...item.properties } })),
                    tags: prepared.tags.map(tag => new Tag(tag))
                }
            };
            if (this._stagedSeeds) this._stagedSeeds.push(this.snapshot(stored));
            else this._history.push(this.snapshot(stored));
            const result = this.success(sequenceNumber, event.constructor.name);
            if (!this._setup) this._results.push(result);
            if (this._stagedNotifications || this.appendOperations.hasSubscribers) {
                const notification = [this.notification(eventSourceId, event, result,
                    prepared.correlationId.toString(), prepared.causationChain, prepared.tags)];
                if (this._stagedNotifications) this._stagedNotifications.push(notification);
                else this.appendOperations.publish(notification);
            }
            return result;
        } finally {
            // Keep the append in flight until its promise crosses an async boundary.
            await Promise.resolve();
            this._busy = false;
        }
    }

    appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(sourceOrEvents: string | EventForEventSourceId[], eventsOrOptions?: object[] | AppendOptions, options?: AppendOptions): Promise<AppendResult[]> {
        if (this._busy || this._setup) throw this.unsupported('appendMany', this.id.value, 'Overlapping calls do not have proven ordering.');
        this._busy = true;
        try {
            const entries = typeof sourceOrEvents === 'string' ? eventsOrOptions as object[] : sourceOrEvents;
            const shared = typeof sourceOrEvents === 'string' ? options : eventsOrOptions as AppendOptions | undefined;
            if (!Array.isArray(entries)) throw this.unsupported('appendMany.arguments', this.id.value, 'Events must be an array.');
            if (!entries.length) throw this.unsupported('appendMany.empty', this.id.value, 'The kernel rejects an empty batch.');
            this.validateBatchOptions(shared);
            if (shared?.occurred !== undefined) this.checkedDate(shared.occurred, 'appendMany.occurred');
            for (const entry of entries) {
                if (typeof sourceOrEvents === 'string') break;
                if (!entry || typeof entry !== 'object' || Reflect.ownKeys(entry).some(key =>
                    !['eventSourceId', 'event', 'eventSourceType', 'eventStreamType', 'eventStreamId', 'subject', 'occurred', 'tags'].includes(String(key)))) {
                    throw this.unsupported('appendMany.entry', this.id.value, 'Unrecognized per-entry metadata.');
                }
                const individual = entry as EventForEventSourceId;
                if (individual.occurred !== undefined) this.checkedDate(individual.occurred, 'appendMany.occurred');
                const tags = individual.tags;
                if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
                    throw this.unsupported('appendMany.tags', this.id.value, 'Only plain string tags are fixture-backed.');
                }
            }
            const batchOptions = shared?.correlationId === undefined && this._correlationId
                ? { ...shared, correlationId: this._correlationId() } : shared;
            if (batchOptions?.correlationId !== undefined) this.validateGuid(batchOptions.correlationId, 'appendMany.correlationId');
            let prepared: ReturnType<typeof prepareBatchAppend>;
            try { prepared = typeof sourceOrEvents === 'string'
                ? prepareBatchAppend(sourceOrEvents, entries as object[], batchOptions)
                : prepareBatchAppend(sourceOrEvents, batchOptions); }
            catch (error) { throw this.unsupported('appendMany.serialization', this.id.value, `Batch preparation failed: ${String(error)}.`); }
            const { eventsForEventSourceIds, eventsToAppend, correlationId, batchCausationChain, identity } = prepared;
            this.validateGuid(correlationId, 'appendMany.correlationId');
            if (identity !== Identity.system || batchCausationChain.length !== 2 ||
                Object.keys(batchCausationChain[0].properties).length !== 0 ||
                batchCausationChain[1].type.name !== 'TypeScriptClient.AppendMany' ||
                batchCausationChain[1].properties.count !== String(entries.length)) {
                throw this.unsupported('appendMany.context', this.id.value, 'Ambient identity or causation metadata is not fixture-backed.');
            }
            const now = this.checkedDate(this._clock(), 'appendMany.clock');
            const staged = eventsForEventSourceIds.map(({ eventSourceId, event }, index) => {
                if (!event || typeof event !== 'object' || !this._catalog.has(event.constructor)) {
                    throw this.unsupported('appendMany.event', event?.constructor?.name ?? this.id.value, 'Event is not in the selected catalog.');
                }
                this.validateSource(eventSourceId, 'appendMany.source');
                const wire = eventsToAppend[index];
                for (const [name, value] of Object.entries({ sourceType: wire.EventSourceType, streamType: wire.EventStreamType,
                    streamId: wire.EventStreamId, subject: wire.Subject })) {
                    if (value !== undefined && (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value))) {
                        throw this.unsupported(`appendMany.${name}`, String(value), 'Only simple metadata identifiers are fixture-backed.');
                    }
                }
                if (wire.Tags.some(tag => !/^[A-Za-z0-9_-]+$/.test(tag))) {
                    throw this.unsupported('appendMany.tags', event.constructor.name, 'Only simple string tags are fixture-backed.');
                }
                const occurred = wire.Occurred ? this.checkedDate(new Date(wire.Occurred.Value), 'appendMany.occurred') : now;
                const content = this.checkedContent(event, wire.Content, 'appendMany.content');
                const canonical = Object.fromEntries(Object.entries(content).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
                const hash = createHash('sha256').update(`${wire.EventType.Id}|${eventSourceId}|${JSON.stringify(canonical)}`).digest('base64');
                const sequenceNumber = new EventSequenceNumber(BigInt(this._history.length + index));
                const eventType = getEventTypeFor(event.constructor);
                const stored: AppendedEvent = { eventType, content, context: {
                    eventStore: this._store, namespace: this._namespace, sequenceNumber: sequenceNumber.value, eventSourceId,
                    eventSourceType: wire.EventSourceType || 'Default', eventStreamType: wire.EventStreamType || 'All',
                    eventStreamId: wire.EventStreamId || 'Default', subject: wire.Subject, hash, causedBy: identity,
                    observationState: EventObservationState.Initial, eventType, occurred, correlationId: correlationId.toString(),
                    causation: batchCausationChain.map(item => ({ type: item.type.name, occurred: item.occurred, properties: { ...item.properties } })),
                    tags: wire.Tags.map(tag => new Tag(tag))
                } };
                return { stored, result: this.success(sequenceNumber, event.constructor.name) };
            });
            // Stage and validate every entry before committing any event or result.
            this._history.push(...staged.map(item => this.snapshot(item.stored)));
            const results = staged.map(item => item.result);
            this._results.push(...results);
            if (this.appendOperations.hasSubscribers) {
                const occurredAt = new Date();
                this.appendOperations.publish(staged.map(({ result }, index) =>
                    this.notification(eventsForEventSourceIds[index].eventSourceId, eventsForEventSourceIds[index].event, result,
                        correlationId.toString(), batchCausationChain, eventsToAppend[index].Tags, occurredAt)));
            }
            return results;
        } finally {
            await Promise.resolve();
            this._busy = false;
        }
    }

    async getNextSequenceNumber(): Promise<EventSequenceNumber> { return new EventSequenceNumber(BigInt(this._history.length)); }

    async getTailSequenceNumber(source?: string, sourceType?: string, streamType?: string, streamId?: string, types?: Constructor[]): Promise<EventSequenceNumber> {
        if (source !== undefined) this.validateReadSource('getTailSequenceNumber.source', source);
        this.validateRouteFilters('getTailSequenceNumber.filters', sourceType, streamType, streamId);
        const ids = this.filterIds(types);
        const last = [...this._history].reverse().find(event => (source === undefined || event.context.eventSourceId === source) &&
            (sourceType === undefined || sourceType === 'Default' || event.context.eventSourceType === sourceType) &&
            (streamType === undefined || streamType === 'All' || event.context.eventStreamType === streamType) &&
            (streamId === undefined || streamId === 'Default' || event.context.eventStreamId === streamId) &&
            (!ids.length || ids.includes(event.eventType.id.value)));
        return last ? new EventSequenceNumber(last.context.sequenceNumber) : EventSequenceNumber.unset;
    }

    async getTailSequenceNumberForObserver(observer: Constructor): Promise<EventSequenceNumber> {
        throw this.unsupported('getTailSequenceNumberForObserver', observer.name, 'Observer discovery is not fixture-backed.');
    }

    async hasEventsFor(source: string): Promise<boolean> {
        this.validateReadSource('hasEventsFor.source', source);
        return this._history.some(event => event.context.eventSourceId === source);
    }

    async getForEventSourceIdAndEventTypes(source: string, types: Constructor[], streamType?: string, streamId?: string, sourceType?: string): Promise<AppendedEvent[]> {
        if (!types.length) throw this.unsupported('getForEventSourceIdAndEventTypes.filters', source, 'Explicit event types are required.');
        this.validateReadSource('getForEventSourceIdAndEventTypes.source', source);
        this.validateRouteFilters('getForEventSourceIdAndEventTypes.filters', sourceType, streamType, streamId);
        const ids = this.filterIds(types);
        return this._history.filter(event => event.context.eventSourceId === source && ids.includes(event.eventType.id.value) &&
            (sourceType === undefined || sourceType === 'Default' || event.context.eventSourceType === sourceType) &&
            (streamType === undefined || streamType === 'All' || event.context.eventStreamType === streamType) &&
            (streamId === undefined || streamId === 'Default' || event.context.eventStreamId === streamId)).map(event => this.snapshot(event));
    }

    async getFromSequenceNumber(sequence: EventSequenceNumber, source?: string, types?: Constructor[]): Promise<AppendedEvent[]> {
        if (sequence.value < 0n || sequence.value > EventSequenceNumber.unset.value) {
            throw this.unsupported('getFromSequenceNumber.sequenceNumber', sequence.value.toString(), 'Sequence numbers must fit unsigned 64-bit wire values.');
        }
        if (source !== undefined) this.validateReadSource('getFromSequenceNumber.source', source);
        const ids = this.filterIds(types);
        return this._history.filter(event => event.context.sequenceNumber >= sequence.value &&
            (source === undefined || event.context.eventSourceId === source) &&
            (!ids.length || ids.includes(event.eventType.id.value))).map(event => this.snapshot(event));
    }

    async redact(): Promise<void> { throw this.unsupported('redact', this.id.value, 'Redaction requires kernel storage.'); }
    async redactForEventSource(): Promise<void> { throw this.unsupported('redactForEventSource', this.id.value, 'Redaction requires kernel storage.'); }
    async completeStream(): Promise<CompleteStreamResult> { throw this.unsupported('completeStream', this.id.value, 'Stream completion requires a kernel.'); }

    private filterIds(types?: Constructor[]): string[] {
        return (types ?? []).map(type => {
            const metadata = this._catalog.get(type);
            if (!metadata) throw this.unsupported('read.eventTypes', type.name, 'Event type is not in the selected catalog.');
            return metadata.eventType.id.value;
        });
    }

    private validateRouteFilters(operation: string, ...filters: (string | undefined)[]): void {
        for (const filter of filters) {
            if (filter !== undefined && (typeof filter !== 'string' || !/^[A-Za-z0-9_-]+$/.test(filter))) {
                throw this.unsupported(operation, String(filter), 'Only simple, nonblank route filters are fixture-backed.');
            }
        }
    }

    private validateBatchOptions(options?: AppendOptions): void {
        if (options === undefined) return;
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            throw this.unsupported('appendMany.options', this.id.value, 'Append options must be an object.');
        }
        const allowed = ['correlationId', 'sourceType', 'streamType', 'streamId', 'subject', 'occurred', 'tags'];
        if (Reflect.ownKeys(options).some(key => !allowed.includes(String(key))) ||
            options.concurrencyScope !== undefined || options.concurrencyScopes !== undefined || options.eventSourceId !== undefined) {
            throw this.unsupported('appendMany.options', this.id.value, 'Concurrency and unrecognized metadata are not fixture-backed.');
        }
        if (options.tags && (!Array.isArray(options.tags) || options.tags.some(tag => typeof tag !== 'string'))) {
            throw this.unsupported('appendMany.tags', this.id.value, 'Only plain string tags are fixture-backed.');
        }
    }

    private validateGuid(value: string | Guid, operation: string): void {
        try {
            toContractsGuid(Guid.as(value));
            if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.toString())) throw new Error('Invalid GUID.');
        } catch { throw this.unsupported(operation, this.id.value, 'Correlation ID must be a valid GUID.'); }
    }

    private checkedDate(value: Date, operation: string): Date {
        if (!(value instanceof Date) || Number.isNaN(value.getTime()) || value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999) {
            throw this.unsupported(operation, this.id.value, 'Occurrence must be within UTC years 1–9999 at millisecond precision.');
        }
        return new Date(value);
    }

    private validateSource(source: string, operation: string): void {
        if (typeof source !== 'string' || !/^[A-Za-z0-9_-]+$/.test(source)) {
            throw this.unsupported(operation, String(source), 'Only simple source identifiers are fixture-backed.');
        }
    }

    private checkedContent(event: object, serialized: string, operation: string): Record<string, unknown> {
        let content: Record<string, unknown>;
        try { content = JSON.parse(serialized) as Record<string, unknown>; }
        catch { throw this.unsupported(operation, event.constructor.name, 'Content must be valid JSON.'); }
        const properties = this._catalog.get(event.constructor)!.schema.properties!;
        if (!content || typeof content !== 'object' || Array.isArray(content) ||
            Object.keys(content).length !== Object.keys(properties).length ||
            Object.entries(properties).some(([key, property]) => typeof content[key] !== property.type ||
                (property.type === 'string' && !/^[\x20-\x21\x23-\x5b\x5d-\x7e\u00e9]*$/.test(content[key] as string)))) {
            throw this.unsupported(operation, event.constructor.name, 'Content differs from the fixture-backed scalar schema.');
        }
        return content;
    }

    private success(sequenceNumber: EventSequenceNumber, artifact: string): AppendResult {
        return Object.freeze({ sequenceNumber: Object.freeze(sequenceNumber), constraintViolations: Object.freeze([]),
            errors: Object.freeze([]), isSuccess: true,
            waitForCompletion: async () => { throw this.unsupported('waitForCompletion', artifact, 'No observers run in process.'); } });
    }

    private notification(source: string, event: object, result: AppendResult, correlationId: string,
        causation: readonly { type: { name: string }; properties: Readonly<Record<string, string>> }[], tags: string[],
        occurredAt = new Date()): AppendedEventWithResult {
        const eventType = getEventTypeFor(event.constructor);
        return { event: { eventType, content: event as Record<string, unknown>, context: {
            sequenceNumber: result.sequenceNumber.value, eventSourceId: source, eventType, occurred: occurredAt, correlationId,
            causation: causation.map(item => ({ type: item.type.name, properties: { ...item.properties } })),
            tags: tags.map(tag => new Tag(tag))
        } }, result };
    }

    private snapshot(event: AppendedEvent): AppendedEvent {
        const eventType = new EventType(new EventTypeId(event.eventType.id.value),
            new EventTypeGeneration(event.eventType.generation.value), event.eventType.tombstone);
        const causedBy = event.context.causedBy;
        return {
            eventType,
            content: JSON.parse(JSON.stringify(event.content)) as Record<string, unknown>,
            context: { ...event.context, eventType, occurred: new Date(event.context.occurred),
                causedBy: causedBy && new Identity(causedBy.subject, causedBy.name, causedBy.userName, causedBy.onBehalfOf),
                causation: event.context.causation.map(item => ({ ...item, occurred: item.occurred && new Date(item.occurred), properties: { ...item.properties } })),
                tags: event.context.tags.map(item => new Tag(item.value)) }
        };
    }

    private validateReadSource(operation: string, source: string): void {
        if (!source.trim() || source !== source.trim() || unprovenFilterCharacters.test(source)) {
            throw this.unsupported(operation, source, 'Blank and padded source filters have unproven kernel normalization.');
        }
    }

    private unsupported(operation: string, artifact: string, reason: string): UnsupportedEventSequenceOperation {
        return new UnsupportedEventSequenceOperation(operation, artifact, reason);
    }
}
