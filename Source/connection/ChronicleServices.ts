// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type {
    ConstraintsClient,
    EventSeedingClient,
    EventSequencesClient,
    EventStoresClient,
    EventTypesClient,
    FailedPartitionsClient,
    IdentitiesClient,
    JobsClient,
    MaterializedReadModelsClient,
    NamespacesClient,
    ObserversClient,
    ProjectionsClient,
    ReactorsClient,
    ReadModelsClient,
    RecommendationsClient,
    ReducersClient,
    ServerClient,
    WebhooksClient
} from '@cratis/chronicle.contracts';
import type { ComplianceClient } from '../compliance/ComplianceContracts';
import type { EventStoreSubscriptionsClient } from '../eventStoreSubscriptions/contracts';
import type { ExternalServicesClient } from '../externalServices/ExternalServicesContracts';

/**
 * Represents all Chronicle gRPC services.
 */
export interface ChronicleServices {
    eventStores: EventStoresClient;
    namespaces: NamespacesClient;
    recommendations: RecommendationsClient;
    identities: IdentitiesClient;
    eventSequences: EventSequencesClient;
    eventTypes: EventTypesClient;
    constraints: ConstraintsClient;
    observers: ObserversClient;
    eventStoreSubscriptions: EventStoreSubscriptionsClient;
    failedPartitions: FailedPartitionsClient;
    reactors: ReactorsClient;
    reducers: ReducersClient;
    projections: ProjectionsClient;
    readModels: ReadModelsClient;
    materializedReadModels: MaterializedReadModelsClient;
    jobs: JobsClient;
    webhooks: WebhooksClient;
    eventSeeding: EventSeedingClient;
    server: ServerClient;
    compliance: ComplianceClient;
    externalServices: ExternalServicesClient;
}