// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { createLogger } from '../logging/createLogger.js';
import { runInBackgroundContext } from '../telemetry/runInBackgroundContext.js';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { IEventStore } from '../IEventStore.js';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import { refuseClientHostedObservers } from '../artifacts/refuseClientHostedObservers.js';
import { ObservationReconnectBackoff, type ObservationReconnectBackoffOptions } from '../observation/ObservationReconnectBackoff.js';
import { classifyStreamError, StreamErrorKind } from '../observation/classifyStreamError.js';
import type { ObservationStreamOutcome } from '../observation/ObservationStreamOutcome.js';
import type { IReactors } from './IReactors.js';
import type { IReactorBuilder } from './IReactorBuilder.js';
import type { IReactorDefinitionBuilder } from './IReactorDefinitionBuilder.js';
import type { IReactorDefinition } from './IReactorDefinition.js';
import type { ReactorId } from './ReactorId.js';
import type { ReactorResultHandler } from './ReactorResultHandler.js';
import type { ReactorServices } from './ReactorServices.js';
import type { ReactorRegistration } from './ReactorRegistration.js';
import { ReactorRegistrationKind } from './ReactorRegistrationKind.js';
import { ReactorRegistrations } from './ReactorRegistrations.js';
import { ReactorBuilder } from './ReactorBuilder.js';
import { ReactorObservation } from './ReactorObservation.js';
import { ReactorPageDispatcher } from './ReactorPageDispatcher.js';
import { prepareReactor, reactorSubscriptionMessage } from './prepareReactor.js';
import type { ReactorSubscription } from './ReactorSubscription.js';
import type { WaitTillSubscribedOptions } from './WaitTillSubscribedOptions.js';
import { waitTillSubscribed } from './waitTillSubscribed.js';

/** Manages discovered and runtime reactors using local-start/local-stop completion semantics. */
export class Reactors implements IReactors {
    private readonly _logger: ReturnType<typeof createLogger>;
    private readonly _unsubscribeDisconnected: () => void;
    private readonly _registrations = new ReactorRegistrations();
    private readonly _observations = new Map<string, ReactorObservation>();
    private readonly _reconnectBackoffs = new Map<string, ObservationReconnectBackoff>();
    private readonly _reobserveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly _lifetime = new AbortController();
    private _registered = false;
    private _disposed = false;

    /** Creates the reactor collection for one event store and namespace. */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _connection: ChronicleConnection,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        private readonly _lifecycle: ConnectionLifecycle,
        private readonly _eventLog: IEventLog,
        private readonly _resultHandler?: ReactorResultHandler,
        private readonly _eventStore?: IEventStore,
        private readonly _artifactActivator?: ClientArtifactsActivator,
        private readonly _skipKeepAlive: boolean = false,
        private readonly _reconnectBackoff: ObservationReconnectBackoffOptions = {}
    ) {
        this._logger = createLogger('@cratis/chronicle/reactors', _connection.logger);
        this._unsubscribeDisconnected = _lifecycle.onDisconnected(async () => {
            this._logger.info('Disconnected — stopping all reactor observations');
            this._registered = false;
            this.disconnectAll();
        });
    }

    /** Stops local observations permanently, without waiting for running user callbacks. */
    dispose(): void {
        this._unsubscribeDisconnected();
        this._disposed = true;
        this._registered = false;
        this._lifetime.abort(new Error('Reactors have been disposed.'));
        this.disconnectAll();
        this._reconnectBackoffs.clear();
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._registrations.discover(this._clientArtifacts.reactors);
    }

    /** @inheritdoc */
    define(id: ReactorId | string, define: (builder: IReactorBuilder) => void): IReactorDefinition {
        const builder = new ReactorBuilder(id, this._clientArtifacts.eventTypes);
        define(builder);
        return builder.build();
    }

    /** @inheritdoc */
    register(): Promise<void>;
    register(definition: IReactorDefinition): Promise<void>;
    register(id: ReactorId | string, define: (builder: IReactorBuilder) => void): Promise<void>;
    register(id: ReactorId | string, configure: (builder: IReactorDefinitionBuilder) => void, handle: IReactorDefinition['handle']): Promise<void>;
    async register(idOrDefinition?: ReactorId | string | IReactorDefinition,
        configure?: (builder: ReactorBuilder) => void, handle?: IReactorDefinition['handle']): Promise<void> {
        if (idOrDefinition !== undefined) {
            this.registerRuntime(idOrDefinition, configure, handle);
            return;
        }
        if (this._skipKeepAlive) refuseClientHostedObservers({ reactors: this._clientArtifacts.reactors, reducers: [] });
        if (this._disposed) return;
        this._registrations.discover(this._clientArtifacts.reactors);
        const registrations = this._registrations.all.map(registration => ({
            registration, subscription: prepareReactor(registration, this._clientArtifacts)
        }));
        this._registered = true;
        for (const { registration, subscription } of registrations) {
            if (!this.hasObservation(registration.id)) this.startObservation(registration, subscription);
        }
    }

    /** @inheritdoc */
    async unregister(id: ReactorId | string): Promise<void> {
        const value = typeof id === 'string' ? id : id.value;
        this._registrations.remove(value);
        clearTimeout(this._reobserveTimers.get(value));
        this._reobserveTimers.delete(value);
        const attempt = this._observations.get(value);
        this._observations.delete(value);
        attempt?.stop();
        this._reconnectBackoffs.delete(value);
    }

    /** @inheritdoc */
    async waitTillSubscribed(id: ReactorId | string, options: WaitTillSubscribedOptions = {}): Promise<void> {
        const value = typeof id === 'string' ? id : id.value;
        const registration = this._registrations.all.find(entry => entry.id === value);
        const eventSequenceId = registration ? prepareReactor(registration, this._clientArtifacts).eventSequenceId : EventSequenceId.eventLog.value;
        await waitTillSubscribed(signal => this._connection.observers.getObserverInformation({
            EventStore: this._eventStoreName, Namespace: this._namespace, ObserverId: value, EventSequenceId: eventSequenceId
        }, { signal }), options, this._lifetime.signal);
    }

    private registerRuntime(idOrDefinition: ReactorId | string | IReactorDefinition,
        configure: ((builder: ReactorBuilder) => void) | undefined, handle: IReactorDefinition['handle'] | undefined): void {
        if (this._disposed) throw new Error('Reactors have been disposed.');
        if (this._skipKeepAlive) throw new Error('Client-hosted reactors require keep-alive.');
        const definition = this.runtimeDefinition(idOrDefinition, configure, handle);
        this._registrations.discover(this._clientArtifacts.reactors);
        const registration: ReactorRegistration = { id: definition.id.value, kind: handle ? ReactorRegistrationKind.Delegate : ReactorRegistrationKind.Fluent, definition };
        const subscription = prepareReactor(registration, this._clientArtifacts);
        this._registrations.add(registration);
        try {
            this._registered = true;
            this.startObservation(registration, subscription);
        } catch (error) {
            this._registrations.remove(registration.id);
            throw error;
        }
    }

    private runtimeDefinition(idOrDefinition: ReactorId | string | IReactorDefinition,
        configure: ((builder: ReactorBuilder) => void) | undefined, handle: IReactorDefinition['handle'] | undefined): IReactorDefinition {
        if (typeof idOrDefinition === 'object' && 'handle' in idOrDefinition) return idOrDefinition;
        const builder = new ReactorBuilder(idOrDefinition, this._clientArtifacts.eventTypes);
        configure?.(builder);
        return builder.build(handle);
    }

    private hasObservation(id: string): boolean {
        return this._observations.has(id) || this._reobserveTimers.has(id);
    }

    private startObservation(registration: ReactorRegistration, subscription: ReactorSubscription): void {
        const attempt = new ReactorObservation(registration, this._lifecycle.connectionId);
        const dispatcher = this.createDispatcher(subscription, attempt.controller.signal);
        attempt.queue.send(reactorSubscriptionMessage(subscription, {
            connectionId: attempt.connectionId, eventStore: this._eventStoreName, namespace: this._namespace
        }));
        this._observations.set(registration.id, attempt);
        this.reconnectBackoffFor(registration.id).streamOpened();
        runInBackgroundContext(() => { void this.runObservation(attempt, subscription, dispatcher); });
    }

    private createDispatcher(subscription: ReactorSubscription, signal: AbortSignal): ReactorPageDispatcher {
        const { reactorType: type } = subscription;
        const reactorInstance = type && !this._artifactActivator ? new (type as new () => Record<string, Function>)() : undefined;
        if (reactorInstance) subscription.validateInstance(reactorInstance);
        const services: ReactorServices | undefined = this._eventStore && {
            eventStore: this._eventStore, readModels: this._eventStore.readModels, signal
        };
        return new ReactorPageDispatcher({
            ...subscription, reactorInstance, services, signal,
            eventStoreName: this._eventStoreName, namespace: this._namespace,
            eventLog: this._eventLog, resultHandler: this._resultHandler,
            artifactActivator: type ? this._artifactActivator : undefined,
            logger: this._logger, connectionLogger: this._connection.logger
        });
    }

    private async runObservation(attempt: ReactorObservation, subscription: ReactorSubscription, dispatcher: ReactorPageDispatcher): Promise<void> {
        const id = attempt.registration.id;
        let outcome: ObservationStreamOutcome = 'ended';
        try {
            outcome = await attempt.observe(this._connection.reactors.observe(attempt.queue, { signal: attempt.controller.signal }), dispatcher, {
                delivered: () => this.reconnectBackoffFor(id).streamDelivered(),
                failed: error => this.streamFailed(attempt, error)
            });
        } catch (error) {
            this._logger.error('Reactor observation failed while handling a delivery', { reactorId: id, error });
        } finally {
            attempt.stop();
        }
        if (!this.isCurrent(attempt)) return;
        this._observations.delete(id);
        if (outcome === 'ended') this.scheduleReobserve(attempt.registration, subscription);
    }

    private isCurrent(attempt: ReactorObservation): boolean {
        return this._observations.get(attempt.registration.id) === attempt;
    }

    private reconnectBackoffFor(id: string): ObservationReconnectBackoff {
        let backoff = this._reconnectBackoffs.get(id);
        if (!backoff) {
            backoff = new ObservationReconnectBackoff(this._reconnectBackoff);
            this._reconnectBackoffs.set(id, backoff);
        }
        return backoff;
    }

    private canObserve(registration: ReactorRegistration): boolean {
        return this._registered && !this._disposed && this._registrations.isCurrent(registration);
    }

    private scheduleReobserve(registration: ReactorRegistration, subscription: ReactorSubscription): void {
        if (!this.canObserve(registration)) return;
        const id = registration.id;
        const delayMs = this.reconnectBackoffFor(id).nextDelayMs();
        this._logger.debug('Waiting before re-establishing reactor observation', { reactorId: id, delayMs });
        const handle = runInBackgroundContext(() => setTimeout(() => {
            this._reobserveTimers.delete(id);
            if (!this.canObserve(registration) || this._observations.has(id)) return;
            this.startObservation(registration, subscription);
        }, delayMs));
        handle.unref?.();
        this._reobserveTimers.set(id, handle);
    }

    private streamFailed(attempt: ReactorObservation, error: unknown): ObservationStreamOutcome {
        if (!this.isCurrent(attempt)) return 'superseded';
        const kind = classifyStreamError(error);
        if (kind === StreamErrorKind.Cancelled && attempt.controller.signal.aborted) return 'stopped';
        if (kind === StreamErrorKind.SessionLost) {
            this._logger.warn('Reactor observation stream lost its session; reconnecting the client', { reactorId: attempt.registration.id, error });
            this._lifecycle.requestReconnect(attempt.connectionId, 'reactor-session-lost', error,
                handlerError => this._logger.error('Reconnect request handler failed', { reactorId: attempt.registration.id, error: handlerError }));
            return 'sessionLost';
        }
        this._logger.error('Reactor observation stream ended unexpectedly', { reactorId: attempt.registration.id, error });
        return 'ended';
    }

    private disconnectAll(): void {
        for (const timer of this._reobserveTimers.values()) clearTimeout(timer);
        this._reobserveTimers.clear();
        const attempts = [...this._observations.values()];
        this._observations.clear();
        for (const attempt of attempts) attempt.stop();
    }
}
