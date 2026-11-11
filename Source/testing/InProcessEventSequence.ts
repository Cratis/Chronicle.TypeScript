// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AppendOperationsBroadcaster } from '../eventSequences/AppendOperationsBroadcaster.js';
import { createAppendNotification, mapAppendNotificationCausation } from '../eventSequences/createAppendNotification.js';
import { createAppendResult } from '../eventSequences/createAppendResult.js';
import { Guid, type Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getTagsFor } from '../events/tagDecorator.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';

import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { AppendedEventWithResult } from '../eventSequences/AppendedEventWithResult.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { IEventSequence } from '../eventSequences/IEventSequence.js';
import type { ITransactionalEventSequence } from '../eventSequences/ITransactionalEventSequence.js';
import type { CompleteStreamResult } from '../eventSequences/CompleteStreamResult.js';
import type { IEventImport } from '../imports/IEventImport.js';
import type { ImportResult } from '../imports/ImportResult.js';
import { getRemovedConstraintNames } from '../events/constraints/removeConstraint.js';
import { InProcessConstraints, type WireConstraintViolation } from './InProcessConstraints.js';
import { supportsEventField } from './EventFieldSchema.js';
import { InProcessBatchAppend } from './InProcessBatchAppend.js';
import { InProcessEventPayload } from './InProcessEventPayload.js';
import { InProcessEventReadFilter } from './InProcessEventReadFilter.js';
import { InProcessSingleAppend } from './InProcessSingleAppend.js';
import type { InProcessEventSequenceEnvironment } from './InProcessEventSequenceEnvironment.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

// JS trim() omits U+0085, which the kernel trims. Reject unproven non-ASCII whitespace and controls.
const unprovenFilterCharacters = /[\u007f-\u009f]|(?=[^\x00-\x7f])\p{White_Space}/u;

// Observers ReactorScenario registers to latch unsupported operations, keyed by sequence.
const unsupportedObservers = new WeakMap<object, (error: UnsupportedEventSequenceOperation) => void>();

/**
 * Observe every unsupported operation a scenario sequence reports, however the caller receives it.
 * Internal to the testing harness; ReactorScenario uses it to fail deliveries that swallow such errors.
 * @param sequence - The in-process sequence to observe.
 * @param observer - Called with each unsupported-operation error the sequence creates.
 */
export function observeUnsupportedOperations(sequence: object, observer: (error: UnsupportedEventSequenceOperation) => void): void {
    unsupportedObservers.set(sequence, observer);
}

/** Fixture-backed, scenario-local append sequence; no kernel or observer scheduler is started. */
export class InProcessEventSequence implements IEventSequence {
    readonly id: EventSequenceId;
    private readonly _catalog = new Map<Function, ReturnType<typeof getEventTypeMetadata>>();
    private readonly _history: AppendedEvent[] = [];
    private readonly _store: string;
    private readonly _namespace: string;
    private readonly _clock: () => Date;
    private readonly _correlationId?: () => string;
    private readonly _payload: InProcessEventPayload;
    private readonly _singleAppend: InProcessSingleAppend;
    private readonly _batchAppend: InProcessBatchAppend;
    private _setup = false;
    private _allowSeedAppend = false;
    private _stagedSeeds?: AppendedEvent[];
    private _stagedNotifications?: AppendedEventWithResult[][];
    private _busy = false;
    private readonly _results: AppendResult[] = [];
    readonly appendOperations = new AppendOperationsBroadcaster<AppendedEventWithResult[]>();

    constructor(options: EventScenarioOptions, eventTypes: Constructor[], private readonly _constraints?: InProcessConstraints) {
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
            if (options.constraints !== 'disabled' &&
                getRemovedConstraintNames(type).some(name => !this._constraints?.isInapplicable(name)) &&
                !this._constraints?.hasRemovalType(eventType.id.value)) {
                throw this.unsupported('artifacts.eventTypes.constraints', type.name, 'Constraint removal is not fixture-backed.');
            }
            if (getTagsFor(type).length) throw this.unsupported('artifacts.eventTypes.tags', type.name, 'Tagged events are not fixture-backed.');
            // Validate the complete schema, not only properties present on a particular event.
            const schema = metadata.schema;
            if (schema.type !== 'object' || schema.compliance?.length || schema.security?.length ||
                schema.enum !== undefined || schema.items !== undefined || schema.format !== undefined ||
                schema.additionalProperties !== false ||
                schema.required?.length !== Object.keys(schema.properties ?? {}).length ||
                !schema.properties || (Object.keys(schema.properties).length === 0 &&
                    !this._constraints?.isRemovalOnlyType(eventType.id.value)) ||
                Object.entries(schema.properties).some(([key, property]) =>
                    !/^[a-z][a-zA-Z0-9]*$/.test(key) || !supportsEventField(property))) {
                throw this.unsupported('artifacts.eventTypes.schema', type.name, 'Only unclassified string, boolean, numeric, Guid, date and object fields are supported.');
            }
            this._catalog.set(type, metadata);
        }
        const environment: InProcessEventSequenceEnvironment = {
            catalog: this._catalog, store: this._store, namespace: this._namespace, sequenceId: this.id.value,
            clock: () => this._clock(), correlationId: this._correlationId ? () => this._correlationId!() : undefined,
            unsupported: (operation, artifact, reason) => this.unsupported(operation, artifact, reason)
        };
        this._payload = new InProcessEventPayload(environment, this._constraints);
        this._singleAppend = new InProcessSingleAppend(environment, this._payload);
        this._batchAppend = new InProcessBatchAppend(environment, this._payload, (sequence, artifact) => this.success(sequence, artifact));
    }

    get results(): readonly AppendResult[] { return Object.freeze([...this._results]); }
    get appendedEvents(): readonly AppendedEvent[] { return Object.freeze(this._history.map(event => this.snapshot(event))); }

    /** Validate and stage all setup appends, then commit and notify in single-append order. */
    async seed(source: string, events: object[], options?: AppendOptions): Promise<void> {
        if (this._setup || this._busy) throw this.unsupported('given.events', this.id.value, 'Overlapping setup calls are not fixture-backed.');
        this._setup = true;
        this._stagedSeeds = [];
        this._stagedNotifications = [];
        try {
            for (const event of events) {
                this._allowSeedAppend = true;
                let pending: Promise<AppendResult>;
                try { pending = this.append(source, event, options); }
                finally { this._allowSeedAppend = false; }
                const result = await pending;
                if (!result.isSuccess) throw new Error(`EventScenario given setup failed: ${JSON.stringify(result, (_, value) =>
                    typeof value === 'bigint' ? value.toString() : value)}`);
            }
            for (const [index, stored] of this._stagedSeeds.entries()) {
                this._history.push(stored);
                this.appendOperations.publish(this._stagedNotifications[index]);
                // Let an async subscriber observe this append before the next enters history.
                await Promise.resolve();
            }
        } finally {
            this._stagedSeeds = undefined;
            this._stagedNotifications = undefined;
            this._setup = false;
        }
    }

    get transactional(): ITransactionalEventSequence { throw this.unsupported('transactional', this.id.value, 'Transactions require a kernel.'); }

    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        if (this.appendBusy()) {
            throw this.unsupported('append', this.id.value, 'Overlapping calls do not have proven ordering.');
        }
        this._busy = true;
        try {
            const { prepared, stored, sequenceNumber } = this._singleAppend.prepare(eventSourceId, event, options,
                this._history.length + (this._stagedSeeds?.length ?? 0));
            const violations = this.validateConstraints([...this._history, ...(this._stagedSeeds ?? [])], [stored]);
            const result = violations.length ? this.rejected(violations) : this.success(sequenceNumber, event.constructor.name);
            this.commitSingle(stored, result);
            this.notifySingle(eventSourceId, event, result, prepared);
            return result;
        } finally {
            // Keep the append in flight until its promise crosses an async boundary.
            await Promise.resolve();
            this._busy = false;
        }
    }

    private appendBusy(): boolean {
        return this._busy || (this._setup && !this._allowSeedAppend);
    }

    private commitSingle(stored: AppendedEvent, result: AppendResult): void {
        if (result.isSuccess) {
            if (this._stagedSeeds) this._stagedSeeds.push(this.snapshot(stored));
            else this._history.push(this.snapshot(stored));
        }
        if (!this._setup) this._results.push(result);
    }

    private notifySingle(eventSourceId: string, event: object, result: AppendResult, prepared: ReturnType<InProcessSingleAppend['prepare']>['prepared']): void {
        if (this._stagedNotifications || this.appendOperations.hasSubscribers) {
            const notification = [createAppendNotification(eventSourceId, event, result,
                prepared.correlationId.toString(), mapAppendNotificationCausation(prepared.causationChain), prepared.tags)];
            if (this._stagedNotifications) this._stagedNotifications.push(notification);
            else this.appendOperations.publish(notification);
        }
    }

    appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(sourceOrEvents: string | EventForEventSourceId[], eventsOrOptions?: object[] | AppendOptions, options?: AppendOptions): Promise<AppendResult[]> {
        if (this._busy || this._setup) throw this.unsupported('appendMany', this.id.value, 'Overlapping calls do not have proven ordering.');
        this._busy = true;
        try {
            const { prepared, staged } = this._batchAppend.prepare(sourceOrEvents, eventsOrOptions, options, this._history.length);
            const { eventsForEventSourceIds, eventsToAppend, correlationId, batchCausationChain } = prepared;
            // The kernel validates the entire batch before persisting any events or allocating sequences.
            const violations = this.validateConstraints(this._history, staged.map(item => item.stored));
            const results = violations.length ? staged.map(() => this.rejected(violations)) : staged.map(item => item.result);
            if (!violations.length) this._history.push(...staged.map(item => this.snapshot(item.stored)));
            this._results.push(...results);
            if (this.appendOperations.hasSubscribers) {
                const occurredAt = new Date();
                const causationEntries = mapAppendNotificationCausation(batchCausationChain);
                this.appendOperations.publish(staged.map((_, index) =>
                    createAppendNotification(eventsForEventSourceIds[index].eventSourceId, eventsForEventSourceIds[index].event, results[index],
                        correlationId.toString(), causationEntries, eventsToAppend[index].Tags, occurredAt)));
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
        const filter = new InProcessEventReadFilter({ source, sourceType, streamType, streamId, ids: this.filterIds(types) });
        const last = [...this._history].reverse().find(event => filter.matches(event));
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
        const filter = new InProcessEventReadFilter({ source, sourceType, streamType, streamId, ids: this.filterIds(types) });
        return this._history.filter(event => filter.matches(event)).map(event => this.snapshot(event));
    }

    async getFromSequenceNumber(sequence: EventSequenceNumber, source?: string, types?: Constructor[]): Promise<AppendedEvent[]> {
        if (sequence.value < 0n || sequence.value > EventSequenceNumber.unset.value) {
            throw this.unsupported('getFromSequenceNumber.sequenceNumber', sequence.value.toString(), 'Sequence numbers must fit unsigned 64-bit wire values.');
        }
        if (source !== undefined) this.validateReadSource('getFromSequenceNumber.source', source);
        const filter = new InProcessEventReadFilter({ source, ids: this.filterIds(types) });
        return this._history.filter(event => event.context.sequenceNumber >= sequence.value && filter.matches(event)).map(event => this.snapshot(event));
    }

    async compensate(): Promise<AppendResult> { throw this.unsupported('compensate', this.id.value, 'Compensation requires kernel storage.'); }
    async redact(): Promise<void> { throw this.unsupported('redact', this.id.value, 'Redaction requires kernel storage.'); }
    async redactForEventSource(): Promise<void> { throw this.unsupported('redactForEventSource', this.id.value, 'Redaction requires kernel storage.'); }
    async copy(): Promise<Guid> { throw this.unsupported('copy', this.id.value, 'Copying events requires kernel jobs.'); }
    async completeStream(): Promise<CompleteStreamResult> { throw this.unsupported('completeStream', this.id.value, 'Stream completion requires a kernel.'); }
    async import(): Promise<ImportResult> { throw this.unsupported('import', this.id.value, 'Importing events requires kernel import sessions.'); }
    async beginImport(): Promise<IEventImport> { throw this.unsupported('beginImport', this.id.value, 'Importing events requires kernel import sessions.'); }

    private filterIds(types?: Constructor[]): string[] {
        return (types ?? []).map(type => {
            const metadata = this._catalog.get(type);
            if (!metadata) throw this.unsupported('read.eventTypes', type.name, 'Event type is not in the selected catalog.');
            return metadata.eventType.id.value;
        });
    }

    private validateRouteFilters(operation: string, ...filters: (string | undefined)[]): void {
        for (const filter of filters) {
            if (filter !== undefined && !this.simpleRouteFilter(filter)) {
                throw this.unsupported(operation, String(filter), 'Only simple, nonblank route filters are fixture-backed.');
            }
        }
    }

    private simpleRouteFilter(filter: string): boolean {
        return typeof filter === 'string' && /^[A-Za-z0-9_-]+$/.test(filter);
    }

    private validateConstraints(history: readonly AppendedEvent[], incoming: readonly AppendedEvent[]): WireConstraintViolation[] {
        try { return this._constraints?.validate(history, incoming) ?? []; }
        catch (error) {
            if (error instanceof UnsupportedEventSequenceOperation) unsupportedObservers.get(this)?.(error);
            throw error;
        }
    }

    private rejected(violations: WireConstraintViolation[]): AppendResult {
        return createAppendResult(18446744073709551615n, violations, [], undefined,
            violation => this._constraints!.resolveMessage(violation), async () => ({ isSuccess: true, failedPartitions: [] }));
    }

    private success(sequenceNumber: EventSequenceNumber, artifact: string): AppendResult {
        return Object.freeze({ sequenceNumber: Object.freeze(sequenceNumber), constraintViolations: Object.freeze([]),
            errors: Object.freeze([]), isSuccess: true,
            waitForCompletion: async () => { throw this.unsupported('waitForCompletion', artifact, 'No observers run in process.'); } });
    }

    private snapshot(event: AppendedEvent): AppendedEvent {
        return this._payload.snapshot(event);
    }

    private validateReadSource(operation: string, source: string): void {
        if (!this.simpleReadSource(source)) {
            throw this.unsupported(operation, source, 'Blank and padded source filters have unproven kernel normalization.');
        }
    }

    private simpleReadSource(source: string): boolean {
        return !!source.trim() && source === source.trim() && !unprovenFilterCharacters.test(source);
    }

    private unsupported(operation: string, artifact: string, reason: string): UnsupportedEventSequenceOperation {
        const error = new UnsupportedEventSequenceOperation(operation, artifact, reason);
        unsupportedObservers.get(this)?.(error);
        return error;
    }
}
