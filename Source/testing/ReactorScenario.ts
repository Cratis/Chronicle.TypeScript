// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { withActivatedArtifact } from '../artifacts/withActivatedArtifact.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { EventContext } from '../events/EventContext.js';
import type { IEventStore } from '../IEventStore.js';
import { getReactorEventTypes, invokeReactorHandler, selectReactorHandler } from '../reactors/ReactorDispatcher.js';
import { getReactorMetadata } from '../reactors/reactor.js';
import { normalizeReactorSideEffects } from '../reactors/ReactorSideEffects.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { EventScenario } from './EventScenario.js';
import type { ReactorDeliveryResult } from './ReactorDeliveryResult.js';
import type { ReactorScenarioOptions } from './ReactorScenarioOptions.js';
import type { RecordedReactorSideEffect } from './RecordedReactorSideEffect.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';

/** Live, ordered reactor deliveries over the fixture-proven EventScenario event boundary. */
export class ReactorScenario {
    readonly given: { forEventSource(id: string): { events(...events: object[]): Promise<void> } };
    readonly when: { forEventSource(id: string): { events(...events: object[]): Promise<void> } };
    private readonly _events: EventScenario;
    private readonly _entries: ReturnType<typeof getReactorEventTypes>;
    private readonly _eventTypes: readonly Constructor[];
    private readonly _instance?: Record<string, Function>;
    private readonly _store: IEventStore;
    private readonly _controller = new AbortController();
    private readonly _effects: RecordedReactorSideEffect[] = [];
    private readonly _results: ReactorDeliveryResult[] = [];
    private _busy = false;
    private _deliveryIndex = 0;

    constructor(private readonly _reactor: Constructor, private readonly _options: ReactorScenarioOptions = {}) {
        const metadata = getReactorMetadata(_reactor);
        if (!metadata) throw new UnsupportedReactorOperation('reactor', _reactor.name, 'A registered @reactor is required.');
        if (metadata.eventSequenceId && metadata.eventSequenceId !== 'event-log') {
            throw new UnsupportedReactorOperation('reactor.eventSequenceId', _reactor.name, 'Only the default event log is fixture-backed.');
        }
        if (_options.commandTypes?.length) {
            throw new UnsupportedReactorOperation('options.commandTypes', _reactor.name, 'Command classification belongs to the explicit-composition increment.');
        }
        this._events = new EventScenario(_options);
        // Capture the catalog once, as production observation does at registration.
        this._eventTypes = _options.artifacts?.eventTypes ?? this.discoveredTypes();
        this._entries = getReactorEventTypes(_reactor, this._eventTypes);
        this._instance = _options.artifactActivator ? undefined : new (_reactor as new () => Record<string, Function>)();
        this._store = _options.servicesEventStore ?? this.scenarioStore();
        this.given = { forEventSource: id => ({ events: (...events) => this.deliver(id, events, true) }) };
        this.when = { forEventSource: id => ({ events: (...events) => this.deliver(id, events, false) }) };
    }

    private discoveredTypes(): Constructor[] {
        // Reuse the production discovery provider, but only once at scenario construction.
        return [...new DefaultClientArtifactsProvider(TypeDiscoverer.default).eventTypes];
    }

    private scenarioStore(): IEventStore {
        const unsupported = (operation: string) => { throw new UnsupportedReactorOperation(`services.${operation}`, this._reactor.name,
            'Provide an explicit eventStore test double for this service.'); };
        const readModels = new Proxy({}, { get: (_, key) => unsupported(`readModels.${String(key)}`) });
        const store = { name: { value: this._options.eventStore ?? 'test-event-store' },
            namespace: { value: this._options.namespace ?? 'default' }, eventLog: this._events.eventLog, readModels };
        return new Proxy(store, { get: (target, key) => key in target ? target[key as keyof typeof target] : unsupported(`eventStore.${String(key)}`) }) as IEventStore;
    }

    get produced(): readonly unknown[] { return Object.freeze(this._effects.map(effect => effect.value)); }
    get sideEffects(): readonly RecordedReactorSideEffect[] { return Object.freeze([...this._effects]); }
    get results(): readonly ReactorDeliveryResult[] { return Object.freeze([...this._results]); }
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

    private async deliver(sourceId: string, input: object[], setup: boolean): Promise<void> {
        if (this._busy) throw new UnsupportedReactorOperation('delivery.overlap', this._reactor.name, 'Concurrent deliveries have unproven ordering.');
        this._busy = true;
        try {
            if (!setup && !input.length) {
                throw new UnsupportedReactorOperation('when.events', this._reactor.name, 'Empty action batches are not fixture-backed.');
            }
            const before = this._events.appendedEvents.length;
            if (setup) {
                await this._events.given.forEventSource(sourceId).events(...input);
            } else {
                const results = await this._events.when.forEventSource(sourceId).events(...input);
                if (results.some(result => !result.isSuccess)) throw new Error('ReactorScenario action append failed.');
            }
            const events = this._events.appendedEvents.slice(before);
            if (events.length) await this.process(sourceId, events);
        } finally {
            this._busy = false;
        }
    }

    private async process(sourceId: string, events: readonly AppendedEvent[]): Promise<void> {
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
                await invokeReactorHandler(artifact, selection.methodName, event.content, event.context, services, result =>
                    this.record(result, event.context, selection.methodName!, deliveryIndex));
                handled.push(event.context);
            }
        };
        try {
            if (first && this._options.artifactActivator) {
                await withActivatedArtifact(this._reactor, { kind: ArtifactKind.Reactor,
                    artifactId: getReactorMetadata(this._reactor)!.id.value, eventStore: this._store,
                    readModels: services.readModels, eventSequenceId: 'event-log', partition: sourceId,
                    signal: services.signal, delivery: ArtifactDelivery.Events, eventContext: first.context },
                this._options.artifactActivator, process);
            } else {
                await process({ instance: this._instance ?? {} });
            }
            outcome.completed = true;
        } catch (error) {
            outcome.error = error;
            throw error;
        } finally {
            this._results.push(Object.freeze({ ...outcome, handled: Object.freeze([...handled]), skipped: Object.freeze([...skipped]) }));
        }
    }

    private async record(result: unknown, context: EventContext, handler: string, deliveryIndex: number): Promise<void> {
        if (await this._options.resultHandler?.(result, context, this._reactor, this._store.name.value, this._store.namespace.value)) return;
        if (result == null) return;
        const items = Array.isArray(result) ? result : [result];
        const events = normalizeReactorSideEffects(result, context.eventSourceId,
            context.eventStreamType ?? 'Default', context.eventStreamId ?? context.eventSourceId);
        if (items.length !== events.length || events.some(entry => !this._eventTypes.includes(entry.event.constructor as Constructor))) {
            throw new UnsupportedReactorOperation('handler.return', this._reactor.name,
                'Only registered events and production EventForEventSourceId wrappers may be recorded; commands and unknown values are unsupported.');
        }
        for (const target of events) {
            this._effects.push(Object.freeze({ kind: 'event', value: target.event, target, triggeringContext: context,
                handler, deliveryIndex }));
        }
    }
}
