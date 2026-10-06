// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Constructor } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { withActivatedArtifact } from '../artifacts/withActivatedArtifact.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { EventContext } from '../events/EventContext.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { mergeNamedTags } from '../events/mergeNamedTags.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getDeclaredEventStreamTypeFor, getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import { ensureNamedTagBatchIsSupported } from '../eventSequences/ensureNamedTagBatchIsSupported.js';
import { EventStoreName } from '../EventStoreName.js';
import { EventStoreNamespaceName } from '../EventStoreNamespaceName.js';
import type { IEventStore } from '../IEventStore.js';
import type { IReadModels } from '../readModels/IReadModels.js';
import { getReactorEventTypes, invokeReactorHandler, selectReactorHandler } from '../reactors/ReactorDispatcher.js';
import { createHandlerInstanceValidator } from '../observation/createHandlerInstanceValidator.js';
import { getReactorMetadata } from '../reactors/reactor.js';
import { normalizeReactorSideEffects } from '../reactors/ReactorSideEffects.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { ReactorDelivery } from '../reactors/ReactorDelivery.js';
import { EventScenario } from './EventScenario.js';
import type { ReactorDeliveryResult } from './ReactorDeliveryResult.js';
import type { ReactorScenarioOptions } from './ReactorScenarioOptions.js';
import type { RecordedReactorSideEffect } from './RecordedReactorSideEffect.js';
import { observeUnsupportedOperations } from './InProcessEventSequence.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';

/** Live, ordered reactor deliveries over the fixture-proven EventScenario event boundary. */
export class ReactorScenario {
    readonly given: { forEventSource(id: string, options?: AppendOptions): { events(...events: object[]): Promise<void> } };
    readonly when: { forEventSource(id: string, options?: AppendOptions): { events(...events: object[]): Promise<void> } };
    private readonly _events: EventScenario;
    private readonly _entries: ReturnType<typeof getReactorEventTypes>;
    private readonly _eventTypes: readonly Constructor[];
    private readonly _instance?: Record<string, Function>;
    private readonly _validateInstance: (instance: object) => void;
    private readonly _store: IEventStore;
    private readonly _controller = new AbortController();
    private readonly _effects: RecordedReactorSideEffect[] = [];
    private readonly _results: ReactorDeliveryResult[] = [];
    private _busy = false;
    private _failed = false;
    // Unsupported calls are attributed only to the delivery that is running when they happen.
    private _delivery?: { violation?: Error };
    private readonly _deliveryContext = new AsyncLocalStorage<{ violation?: Error }>();
    private _deliveryIndex = 0;

    constructor(private readonly _reactor: Constructor, private readonly _options: ReactorScenarioOptions = {}) {
        const metadata = getReactorMetadata(_reactor);
        if (!metadata) throw new UnsupportedReactorOperation('reactor', _reactor.name, 'A registered @reactor is required.');
        if ((metadata.eventSequenceId ?? 'event-log') !== 'event-log') {
            throw new UnsupportedReactorOperation('reactor.eventSequenceId', _reactor.name, 'Only the default event log is fixture-backed.');
        }
        if (getFilterTagsFor(_reactor).length) {
            throw new UnsupportedReactorOperation('reactor.filterEventsByTag', _reactor.name, 'Tag-filtered delivery is not fixture-backed.');
        }
        if (getEventSourceTypeFor(_reactor) !== '') {
            throw new UnsupportedReactorOperation('reactor.eventSourceType', _reactor.name, 'Source-type-filtered delivery is not fixture-backed.');
        }
        if (getEventStreamTypeFor(_reactor) !== 'All') {
            throw new UnsupportedReactorOperation('reactor.eventStreamType', _reactor.name, 'Stream-type-filtered delivery is not fixture-backed.');
        }
        if (_options.commandTypes?.length) {
            throw new UnsupportedReactorOperation('options.commandTypes', _reactor.name, 'Command classification belongs to the explicit-composition increment.');
        }
        // Resolve the selected or discovered catalog once; preserve getter-backed constraints and migrations.
        const artifacts = _options.artifacts ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        const constraints = artifacts.constraints;
        // EventScenario rejects an explicitly selected empty catalog, but allows empty default discovery.
        const selectedConstraints = !_options.artifacts && constraints?.length === 0 ? undefined : constraints;
        const eventTypeMigrations = artifacts.eventTypeMigrations;
        this._eventTypes = Object.freeze([...artifacts.eventTypes]);
        this._events = new EventScenario({ ..._options, artifacts: {
            eventTypes: [...this._eventTypes],
            constraints: selectedConstraints === undefined ? undefined : [...selectedConstraints],
            eventTypeMigrations: eventTypeMigrations === undefined ? undefined : [...eventTypeMigrations]
        } });
        this._entries = getReactorEventTypes(_reactor, this._eventTypes);
        this._validateInstance = createHandlerInstanceValidator(_reactor,
            this._entries.flatMap(entry => [entry.methodName, entry.replayMethodName].filter((name): name is string => !!name)));
        // Every unsupported event-sequence operation is latched at its source, whichever result or stream carries it.
        observeUnsupportedOperations(this._events.eventSequence, error => { this.latch(error); });
        this._instance = _options.artifactActivator ? undefined : new (_reactor as new () => Record<string, Function>)();
        if (this._instance) this._validateInstance(this._instance);
        this._store = _options.servicesEventStore ?? this.scenarioStore();
        this.given = { forEventSource: (id, options) => ({ events: (...events) => this.deliver(id, events, true, options) }) };
        this.when = { forEventSource: (id, options) => ({ events: (...events) => this.deliver(id, events, false, options) }) };
    }

    private scenarioStore(): IEventStore {
        const unsupported = (operation: string): never => { throw this.violation(`services.${operation}`,
            'Provide an explicit eventStore test double for this service.'); };
        const readModelMethods = new Set(['register', 'getInstanceById', 'findInstanceById', 'getInstances',
            'getSnapshotsById', 'dehydrateSession', 'release', 'releaseMany']);
        const readModels = new Proxy({}, { get: (_, key) => {
            if (key === 'watch') return async function* () { unsupported('readModels.watch'); };
            if (key === 'createWatcher') return () => unsupported('readModels.createWatcher');
            if (key === 'materialized') return unsupported('readModels.materialized');
            if (typeof key !== 'string' || !readModelMethods.has(key)) return undefined;
            return async () => unsupported(`readModels.${key}`);
        } }) as IReadModels;
        const eventLog = this._events.eventLog;
        const rejectSubscribed = (events: readonly object[]) => {
            if (events.some(event => {
                const id = getEventTypeMetadata(event.constructor)?.eventType.id.value;
                return this._entries.some(entry => entry.id === id);
            })) {
                throw this.violation('services.eventLog.append.subscribed',
                    'Delivery of a reactor\'s own appended events is not supported.');
            }
        };
        const guardedLog = new Proxy(eventLog, { get: (target, key) => {
            if (key === 'append') return async (...args: Parameters<IEventLog['append']>) => {
                rejectSubscribed([args[1]]);
                return target.append(...args);
            };
            if (key === 'appendMany') return async (sourceOrEvents: string | EventForEventSourceId[],
                eventsOrOptions?: object[] | AppendOptions, options?: AppendOptions) => {
                if (typeof sourceOrEvents === 'string') {
                    rejectSubscribed(eventsOrOptions as object[]);
                    return target.appendMany(sourceOrEvents, eventsOrOptions as object[], options);
                }
                rejectSubscribed(sourceOrEvents.map(entry => entry.event));
                return target.appendMany(sourceOrEvents, eventsOrOptions as AppendOptions | undefined);
            };
            const value = Reflect.get(target, key, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        } }) as IEventLog;
        const store = { name: new EventStoreName(this._options.eventStore ?? 'test-event-store'),
            namespace: new EventStoreNamespaceName(this._options.namespace ?? 'default'), eventLog: guardedLog, readModels };
        const unsupportedStoreProperties = new Set(['eventTypes', 'constraints', 'projections', 'reactors', 'reducers',
            'unitOfWorkManager', 'jobs', 'webhooks', 'subscriptions', 'seeding', 'externalServices', 'identities',
            'pii', 'failedPartitions', 'observers', 'patterns']);
        return new Proxy(store, { get: (target, key) => {
            if (typeof key !== 'string') return undefined;
            if (Object.hasOwn(target, key)) return target[key as keyof typeof target];
            if (key === 'getNamespaces') return async () => unsupported('eventStore.getNamespaces');
            if (key === 'getEventSequence') return () => unsupported('eventStore.getEventSequence');
            if (unsupportedStoreProperties.has(key)) return unsupported(`eventStore.${key}`);
            return undefined;
        } }) as IEventStore;
    }

    get produced(): readonly unknown[] { return Object.freeze(this._effects.map(effect => effect.value)); }
    get sideEffects(): readonly RecordedReactorSideEffect[] { return Object.freeze([...this._effects]); }
    get results(): readonly ReactorDeliveryResult[] { return Object.freeze([...this._results]); }
    /** Committed input and explicit service appends; recorded returned effects are not part of this history. */
    get appendedEvents(): readonly AppendedEvent[] { return this._events.appendedEvents; }
    /** Assertion view, deliberately not a callable Promise-like `then`. */
    get then(): { readonly produced: readonly unknown[]; readonly sideEffects: readonly RecordedReactorSideEffect[];
        readonly results: readonly ReactorDeliveryResult[] } {
        return { produced: this.produced, sideEffects: this.sideEffects, results: this.results };
    }
    shouldHaveProduced<T>(type: new (...args: never[]) => T, predicate: (value: T) => boolean = () => true): void {
        if (!this.produced.some(value => value instanceof type && predicate(value))) {
            throw new Error(`Expected reactor '${this._reactor.name}' to produce a matching '${type.name}'.`);
        }
    }
    shouldNotHaveProduced(type: Function): void {
        if (this.produced.some(value => value instanceof type)) {
            throw new Error(`Expected reactor '${this._reactor.name}' to produce no '${type.name}'.`);
        }
    }

    /** Replay, redelivery and scheduler semantics need a separate kernel-backed increment. */
    async replay(): Promise<never> {
        throw new UnsupportedReactorOperation('replay', this._reactor.name, 'Replay scheduling and observation state are not supported.');
    }
    async redeliver(): Promise<never> {
        throw new UnsupportedReactorOperation('redeliver', this._reactor.name, 'Retry and checkpoint semantics are not supported.');
    }

    private async deliver(sourceId: string, input: object[], setup: boolean, options?: AppendOptions): Promise<void> {
        if (this._failed) throw new UnsupportedReactorOperation('delivery.afterFailure', this._reactor.name,
            'A previous delivery failed; failed-partition retries are not supported.');
        if (this._busy) throw new UnsupportedReactorOperation('delivery.overlap', this._reactor.name, 'Concurrent deliveries have unproven ordering.');
        this._busy = true;
        try {
            if (!setup && !input.length) {
                throw new UnsupportedReactorOperation('when.events', this._reactor.name, 'Empty action batches are not fixture-backed.');
            }
            const before = this._events.appendedEvents.length;
            if (setup) {
                await this._events.given.forEventSource(sourceId, options).events(...input);
            } else {
                const results = await this._events.when.forEventSource(sourceId, options).events(...input);
                const failures = results.filter(result => !result.isSuccess);
                if (failures.length) throw new Error(`ReactorScenario action append failed: ${JSON.stringify(failures, (_, value) =>
                    typeof value === 'bigint' ? value.toString() : value)}`);
            }
            const events = this._events.appendedEvents.slice(before);
            if (events.length) await this.process(sourceId, events);
        } finally {
            this._busy = false;
        }
    }

    private violation(operation: string, reason: string): UnsupportedReactorOperation {
        return this.latch(new UnsupportedReactorOperation(operation, this._reactor.name, reason)) as UnsupportedReactorOperation;
    }

    private latch(error: unknown): unknown {
        // Attribute the call to the delivery whose async context made it, and only while that delivery is running.
        const delivery = this._deliveryContext.getStore();
        if (delivery && delivery === this._delivery &&
            (error instanceof UnsupportedReactorOperation || error instanceof UnsupportedEventSequenceOperation)) {
            delivery.violation ??= error;
        }
        return error;
    }

    private throwIfViolated(delivery: { violation?: Error }): void {
        if (delivery.violation) throw delivery.violation;
    }

    private async process(sourceId: string, events: readonly AppendedEvent[]): Promise<void> {
        const delivery: { violation?: Error } = {};
        this._delivery = delivery;
        const deliveryIndex = this._deliveryIndex++;
        const handled: EventContext[] = [];
        const skipped: EventContext[] = [];
        const outcome: { sourceId: string; handled: EventContext[]; skipped: EventContext[]; completed: boolean; error?: unknown } =
            { sourceId, handled, skipped, completed: false };
        const services: ReactorServices = { eventStore: this._store, readModels: this._store.readModels, signal: this._controller.signal };
        const first = events.find(event => !!selectReactorHandler(this._entries, this._reactor, this._instance,
            event.eventType.id.value, event.context.observationState ?? 0)?.methodName);
        const process = async (artifact: ActivatedArtifact<Record<string, Function>>) => {
            for (const event of events) {
                // EventScenario's serialized history is the committed boundary, not the original input instance.
                if (event.context.observationState !== 1) {
                    throw new UnsupportedReactorOperation('delivery.observationState', this._reactor.name,
                        'Only initial live delivery is fixture-backed.');
                }
                const selection = selectReactorHandler(this._entries, this._reactor, artifact.instance,
                    event.eventType.id.value, event.context.observationState);
                if (!selection?.methodName || selection.skipReplay) { skipped.push(event.context); continue; }
                await invokeReactorHandler(artifact, selection.methodName, event.content, event.context, services, result => {
                    // A swallowed unsupported call fails this event like a throwing handler: nothing is recorded.
                    this.throwIfViolated(delivery);
                    return this.record(result, event.context, selection.methodName!, deliveryIndex);
                }, new ReactorDelivery(getReactorMetadata(this._reactor)!.id.value,
                    event.context.eventStore ?? this._options.eventStore ?? 'test-event-store',
                    event.context.namespace ?? this._options.namespace ?? 'default', 'event-log',
                    event.context.eventSourceId, event.context.sequenceNumber));
                this.throwIfViolated(delivery);
                handled.push(event.context);
            }
        };
        try {
            await this._deliveryContext.run(delivery, async () => {
                if (first && this._options.artifactActivator) {
                    await withActivatedArtifact(this._reactor, { kind: ArtifactKind.Reactor,
                        artifactId: getReactorMetadata(this._reactor)!.id.value, eventStore: this._store,
                        readModels: services.readModels, eventSequenceId: 'event-log', partition: sourceId,
                        signal: services.signal, delivery: ArtifactDelivery.Events, eventContext: first.context },
                    this._options.artifactActivator, artifact => {
                        this._validateInstance(artifact.instance);
                        return process(artifact);
                    });
                } else {
                    await process({ instance: this._instance ?? {} });
                }
            });
            // A handler that catches an unsupported-service rejection must not turn it into a successful delivery.
            this.throwIfViolated(delivery);
            outcome.completed = true;
        } catch (error) {
            outcome.error = error;
            this._failed = true;
            throw error;
        } finally {
            if (this._delivery === delivery) this._delivery = undefined;
            this._results.push(Object.freeze({ ...outcome, handled: Object.freeze([...handled]), skipped: Object.freeze([...skipped]) }));
        }
    }

    private async record(result: unknown, context: EventContext, handler: string, deliveryIndex: number): Promise<void> {
        if (await this._options.resultHandler?.(result, context, this._reactor,
            this._options.eventStore ?? 'test-event-store', this._options.namespace ?? 'default')) return;
        if (result == null) return;
        const items = Array.isArray(result) ? result : [result];
        const events = normalizeReactorSideEffects(result, context.eventSourceId,
            context.eventStreamType ?? 'Default', context.eventStreamId ?? context.eventSourceId,
            getEventSourceTypeFor(this._reactor), getDeclaredEventStreamTypeFor(this._reactor));
        if (items.length !== events.length || events.some(entry => !this._eventTypes.includes(entry.event.constructor as Constructor))) {
            throw new UnsupportedReactorOperation('handler.return', this._reactor.name,
                'Only registered events and production EventForEventSourceId wrappers may be recorded; commands and unknown values are unsupported.');
        }
        // Production validates named tags before appending, failing the delivery on an invalid tag; so does recording.
        for (const target of events) mergeNamedTags(target.namedTags);
        ensureNamedTagBatchIsSupported(events.some(event => mergeNamedTags(event.namedTags).length > 0),
            events.some(event => event.eventSource !== undefined));
        for (const target of events) {
            this._effects.push(Object.freeze({ kind: 'event', value: target.event, target, triggeringContext: context,
                handler, deliveryIndex }));
        }
    }
}
