// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createLogger } from './logging/createLogger.js';
import type { ChronicleTelemetryOptions } from './telemetry/ChronicleTelemetryOptions.js';
import { setTelemetryAttribute, recordSafeException } from './telemetry/spanAttributes.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { ChronicleConnection } from './connection/index.js';
import { ConnectionLifecycle } from './connection/ConnectionLifecycle.js';
import { ensureQuerySuccess } from './connection/callResults.js';
import { EventLog } from './eventSequences/EventLog.js';
import { EventSequence } from './eventSequences/EventSequence.js';
import { EventSequenceId } from './eventSequences/EventSequenceId.js';
import { IEventLog } from './eventSequences/IEventLog.js';
import { IEventSequence } from './eventSequences/IEventSequence.js';
import { EventStoreName } from './EventStoreName.js';
import { EventStoreNamespaceName } from './EventStoreNamespaceName.js';
import { IEventStore } from './IEventStore.js';
import { EventTypes } from './events/EventTypes.js';
import { IEventTypes } from './events/IEventTypes.js';
import { Constraints } from './events/constraints/Constraints.js';
import { IConstraints } from './events/constraints/IConstraints.js';
import { Projections } from './projections/Projections.js';
import { IProjections } from './projections/IProjections.js';
import { Reactors } from './reactors/Reactors.js';
import { getReactorEventTypes } from './reactors/ReactorDispatcher.js';
import { getEventHandlers } from './observation/getEventHandlers.js';
import type { ReactorResultHandler } from './reactors/ReactorResultHandler.js';
import type { ClientArtifactsActivator } from './artifacts/ClientArtifactsActivator.js';
import type { ReadModelNamingPolicy } from './readModels/ReadModelNamingPolicy.js';
import { IReactors } from './reactors/IReactors.js';
import { Reducers } from './reducers/Reducers.js';
import { IReducers } from './reducers/IReducers.js';
import { IReadModels } from './readModels/IReadModels.js';
import { ReadModels } from './readModels/ReadModels.js';
import { EventSeeding } from './seeding/EventSeeding.js';
import { IEventSeeding } from './seeding/IEventSeeding.js';
import { observeOperation } from './telemetry/observeOperation.js';
import { DefaultClientArtifactsProvider } from './artifacts/DefaultClientArtifactsProvider.js';
import type { IClientArtifactsProvider } from './artifacts/IClientArtifactsProvider.js';
import { validateArtifactSchemas } from './artifacts/validateArtifactSchemas.js';
import { IUnitOfWorkManager } from './transactions/IUnitOfWorkManager.js';
import { UnitOfWorkManager } from './transactions/UnitOfWorkManager.js';
import { IJobs } from './jobs/IJobs.js';
import { Jobs } from './jobs/Jobs.js';
import { Patterns, type IPatterns } from './patterns/index.js';
import { IWebhooks } from './webhooks/IWebhooks.js';
import { Webhooks } from './webhooks/Webhooks.js';
import { EventStoreSubscriptions } from './eventStoreSubscriptions/EventStoreSubscriptions.js';
import { IEventStoreSubscriptions } from './eventStoreSubscriptions/IEventStoreSubscriptions.js';
import { ExternalServices } from './externalServices/ExternalServices.js';
import { IExternalServices } from './externalServices/IExternalServices.js';
import { IdentityManager } from './identities/IdentityManager.js';
import { IIdentityManager } from './identities/IIdentityManager.js';
import { PIIManager } from './compliance/PIIManager.js';
import { IPIIManager } from './compliance/IPIIManager.js';
import { FailedPartitions } from './observation/FailedPartitions.js';
import { IFailedPartitions } from './observation/IFailedPartitions.js';
import { IObservers } from './observation/IObservers.js';
import { Observers } from './observation/Observers.js';

/**
 * Implements {@link IEventStore} by communicating with the Chronicle Kernel
 * via gRPC using the provided {@link ChronicleConnection}.
 */
export class EventStore implements IEventStore {
    private readonly _logger: ReturnType<typeof createLogger>;

    readonly eventLog: IEventLog;
    readonly eventTypes: IEventTypes;
    readonly constraints: IConstraints;
    readonly projections: IProjections;
    readonly reactors: IReactors;
    readonly reducers: IReducers;
    readonly readModels: IReadModels;
    readonly unitOfWorkManager: IUnitOfWorkManager;
    readonly jobs: IJobs;
    readonly patterns: IPatterns;
    readonly webhooks: IWebhooks;
    readonly subscriptions: IEventStoreSubscriptions;
    readonly seeding: IEventSeeding;
    readonly externalServices: IExternalServices;
    readonly identities: IIdentityManager;
    readonly pii: IPIIManager;
    readonly failedPartitions: IFailedPartitions;
    readonly observers: IObservers;

    private readonly _sequences: Map<string, IEventSequence> = new Map();
    private readonly _constraints: Constraints;

    constructor(
        readonly name: EventStoreName,
        readonly namespace: EventStoreNamespaceName,
        private readonly _connection: ChronicleConnection,
        lifecycle: ConnectionLifecycle,
        defaultSinkTypeId: string,
        private readonly _artifacts: IClientArtifactsProvider = DefaultClientArtifactsProvider.default,
        reactorResultHandler?: ReactorResultHandler,
        artifactActivator?: ClientArtifactsActivator,
        readModelNamingPolicy?: ReadModelNamingPolicy,
        private readonly _telemetry?: ChronicleTelemetryOptions
    ) {
        this._logger = createLogger('@cratis/chronicle/EventStore', _connection.logger);
        this.unitOfWorkManager = new UnitOfWorkManager(this);

        const artifacts = this._artifacts;
        this._constraints = new Constraints(name.value, _connection, artifacts);
        this.constraints = this._constraints;
        const resolveConstraintMessage = this._constraints.resolveMessageFor.bind(this._constraints);
        this.eventLog = new EventLog(name.value, namespace.value, _connection, this.unitOfWorkManager, resolveConstraintMessage, _telemetry);
        this._sequences.set(EventSequenceId.eventLog.value, this.eventLog);

        this.eventTypes = new EventTypes(name.value, _connection, artifacts);
        this.projections = new Projections(name.value, namespace.value, _connection, artifacts, defaultSinkTypeId, readModelNamingPolicy);
        this.reactors = new Reactors(artifacts, _connection, name.value, namespace.value, lifecycle, this.eventLog, reactorResultHandler, this, artifactActivator);
        this.reducers = new Reducers(artifacts, _connection, name.value, namespace.value, lifecycle, defaultSinkTypeId, this, artifactActivator, readModelNamingPolicy);
        this.readModels = new ReadModels(name.value, namespace.value, _connection, artifacts, defaultSinkTypeId, readModelType => this.projections.hasForModel(readModelType), readModelNamingPolicy);
        this.jobs = new Jobs(name.value, namespace.value, _connection);
        this.patterns = new Patterns(name.value, namespace.value, _connection);
        this.webhooks = new Webhooks(name.value, _connection, this.eventTypes, artifacts);
        this.subscriptions = new EventStoreSubscriptions(this.eventTypes, name.value, _connection);
        this.seeding = new EventSeeding(name.value, _connection, artifacts);
        this.externalServices = new ExternalServices(name.value, _connection);
        this.identities = new IdentityManager(name.value, namespace.value, _connection);
        this.pii = new PIIManager(name.value, namespace.value, _connection);
        this.failedPartitions = new FailedPartitions(name.value, namespace.value, _connection);
        this.observers = new Observers(name.value, namespace.value, _connection);
    }

    /**
     * Registers all discovered artifacts with the Chronicle Kernel.
     * Called on initial connect and on reconnect.
     * @returns A promise that resolves when all registrations are complete.
     */
    async registerArtifacts(): Promise<void> {
        this._logger.debug('Discovering artifacts for registration', {
            eventStore: this.name.value,
            namespace: this.namespace.value
        });

        await this.eventTypes.discover();
        await Promise.all([
            this.constraints.discover(),
            this.projections.discover(),
            this.reactors.discover(),
            this.reducers.discover(),
            this.webhooks.discover(),
            this.seeding.discover()
        ]);

        validateArtifactSchemas(this._artifacts);
        for (const type of this._artifacts.reactors) {
            getReactorEventTypes(type, this._artifacts.eventTypes);
        }
        for (const type of this._artifacts.reducers) {
            getEventHandlers(type, this._artifacts.eventTypes);
        }

        this._logger.debug('Registering discovered artifacts', {
            eventStore: this.name.value,
            namespace: this.namespace.value
        });

        await this.eventTypes.register();
        await Promise.all([
            this.constraints.register(),
            this.projections.register(),
            this.reactors.register(),
            this.reducers.register(),
            this.webhooks.registerDiscovered()
        ]);

        await this.seeding.register();

        this._logger.info('Artifact registration completed', {
            eventStore: this.name.value,
            namespace: this.namespace.value
        });
    }

    /** Stops the store's long-lived observations when the client is disposed. */
    disposeObservations(): void {
        (this.reactors as Reactors).dispose();
        (this.reducers as Reducers).dispose();
    }

    /** @inheritdoc */
    getEventSequence(id: EventSequenceId): IEventSequence {
        const existing = this._sequences.get(id.value);
        if (existing) {
            return existing;
        }

        const sequence = new EventSequence(
            id, this.name.value, this.namespace.value, this._connection, this.unitOfWorkManager,
            this._constraints.resolveMessageFor.bind(this._constraints), this._telemetry
        );
        this._sequences.set(id.value, sequence);
        return sequence;
    }

    /** @inheritdoc */
    async getNamespaces(): Promise<EventStoreNamespaceName[]> {
        return observeOperation('getNamespaces', this._telemetry, async span => {
            setTelemetryAttribute(span, 'eventStore', this.name.value);
            try {
                const response = await this._connection.namespaces.allNamespaces({ EventStore: this.name.value });
                const result = ensureQuerySuccess('get namespaces', response).map(namespace => new EventStoreNamespaceName(namespace.Name));
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                recordSafeException(span, error);
                throw error;
            } finally {
                span.end();
            }
        });
    }
}
