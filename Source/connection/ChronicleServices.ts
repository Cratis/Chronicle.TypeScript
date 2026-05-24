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
    NamespacesClient,
    ObserversClient,
    ProjectionsClient,
    ReactorsClient,
    ReadModelsClient,
    RecommendationsClient,
    ReducersClient,
    ServerClient
} from '@cratis/chronicle.contracts';

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
    failedPartitions: FailedPartitionsClient;
    reactors: ReactorsClient;
    reducers: ReducersClient;
    projections: ProjectionsClient;
    readModels: ReadModelsClient;
    jobs: JobsClient;
    eventSeeding: EventSeedingClient;
    server: ServerClient;
}