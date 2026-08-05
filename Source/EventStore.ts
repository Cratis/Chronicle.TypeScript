// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { ChronicleConnection } from './connection';
import { ConnectionLifecycle } from './connection/ConnectionLifecycle';
import { EventLog } from './eventSequences/EventLog';
import { EventSequence } from './eventSequences/EventSequence';
import { EventSequenceId } from './eventSequences/EventSequenceId';
import { IEventLog } from './eventSequences/IEventLog';
import { IEventSequence } from './eventSequences/IEventSequence';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IEventStore } from './IEventStore';
import { EventTypes } from './events/EventTypes';
import { IEventTypes } from './events/IEventTypes';
import { Constraints } from './events/constraints/Constraints';
import { IConstraints } from './events/constraints/IConstraints';
import { Projections } from './projections/Projections';
import { IProjections } from './projections/IProjections';
import { Reactors } from './reactors/Reactors';
import { IReactors } from './reactors/IReactors';
import { Reducers } from './reducers/Reducers';
import { IReducers } from './reducers/IReducers';
import { IReadModels } from './readModels/IReadModels';
import { ReadModels } from './readModels/ReadModels';
import { EventSeeding } from './seeding/EventSeeding';
import { IEventSeeding } from './seeding/IEventSeeding';
import { ChronicleTracer } from './Tracing';
import { DefaultClientArtifactsProvider } from './artifacts/DefaultClientArtifactsProvider';
import { IUnitOfWorkManager } from './transactions/IUnitOfWorkManager';
import { UnitOfWorkManager } from './transactions/UnitOfWorkManager';
import { IJobs } from './jobs/IJobs';
import { Jobs } from './jobs/Jobs';
import { IWebhooks } from './webhooks/IWebhooks';
import { Webhooks } from './webhooks/Webhooks';
import { EventStoreSubscriptions } from './eventStoreSubscriptions/EventStoreSubscriptions';
import { IEventStoreSubscriptions } from './eventStoreSubscriptions/IEventStoreSubscriptions';
import { ExternalServices } from './externalServices/ExternalServices';
import { IExternalServices } from './externalServices/IExternalServices';
import { IdentityManager } from './identities/IdentityManager';
import { IIdentityManager } from './identities/IIdentityManager';
import { PIIManager } from './compliance/PIIManager';
import { IPIIManager } from './compliance/IPIIManager';

/**
 * Implements {@link IEventStore} by communicating with the Chronicle Kernel
 * via gRPC using the provided {@link ChronicleConnection}.
 */
export class EventStore implements IEventStore {
    private readonly _logger = diag.createComponentLogger({
        namespace: '@cratis/chronicle/EventStore'
    });

    readonly eventLog: IEventLog;
    readonly eventTypes: IEventTypes;
    readonly constraints: IConstraints;
    readonly projections: IProjections;
    readonly reactors: IReactors;
    readonly reducers: IReducers;
    readonly readModels: IReadModels;
    readonly unitOfWorkManager: IUnitOfWorkManager;
    readonly jobs: IJobs;
    readonly webhooks: IWebhooks;
    readonly subscriptions: IEventStoreSubscriptions;
    readonly seeding: IEventSeeding;
    readonly externalServices: IExternalServices;
    readonly identities: IIdentityManager;
    readonly pii: IPIIManager;

    private readonly _sequences: Map<string, IEventSequence> = new Map();

    constructor(
        readonly name: EventStoreName,
        readonly namespace: EventStoreNamespaceName,
        private readonly _connection: ChronicleConnection,
        lifecycle: ConnectionLifecycle,
        defaultSinkTypeId: string
    ) {
        this.unitOfWorkManager = new UnitOfWorkManager(this);

        this.eventLog = new EventLog(name.value, namespace.value, _connection, this.unitOfWorkManager);
        this._sequences.set(EventSequenceId.eventLog.value, this.eventLog);

        const artifacts = DefaultClientArtifactsProvider.default;
        this.eventTypes = new EventTypes(name.value, _connection, artifacts);
        this.constraints = new Constraints(name.value, _connection, artifacts);
        this.projections = new Projections(name.value, _connection, artifacts, defaultSinkTypeId);
        this.reactors = new Reactors(artifacts, _connection, name.value, namespace.value, lifecycle, this.eventLog);
        this.reducers = new Reducers(artifacts, _connection, name.value, namespace.value, lifecycle, defaultSinkTypeId);
        this.readModels = new ReadModels(name.value, namespace.value, _connection, artifacts, defaultSinkTypeId);
        this.jobs = new Jobs(name.value, namespace.value, _connection);
        this.webhooks = new Webhooks(name.value, _connection, this.eventTypes, artifacts);
        this.subscriptions = new EventStoreSubscriptions(this.eventTypes, name.value, _connection);
        this.seeding = new EventSeeding(name.value, _connection, artifacts);
        this.externalServices = new ExternalServices(name.value, _connection);
        this.identities = new IdentityManager(name.value, namespace.value, _connection);
        this.pii = new PIIManager(name.value, namespace.value, _connection);
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

    /** @inheritdoc */
    getEventSequence(id: EventSequenceId): IEventSequence {
        const existing = this._sequences.get(id.value);
        if (existing) {
            return existing;
        }

        const sequence = new EventSequence(id, this.name.value, this.namespace.value, this._connection, this.unitOfWorkManager);
        this._sequences.set(id.value, sequence);
        return sequence;
    }

    /** @inheritdoc */
    async getNamespaces(): Promise<EventStoreNamespaceName[]> {
        return ChronicleTracer.startActiveSpan('chronicle.event_store.get_namespaces', async span => {
            span.setAttribute('chronicle.event_store', this.name.value);
            try {
                const response = await this._connection.namespaces.getNamespaces({ EventStore: this.name.value });
                const result = (response.items ?? []).map((namespace: string) => new EventStoreNamespaceName(namespace));
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }
}
