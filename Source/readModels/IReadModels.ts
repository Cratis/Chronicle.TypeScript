// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IMaterializedReadModels } from './IMaterializedReadModels';
import type { ReadModelChangeset } from './ReadModelChangeset';
import type { ReadModelSnapshot } from './ReadModelSnapshot';

/**
 * Defines a system that works with read models in the event store.
 */
export interface IReadModels {
    /**
     * Gets the {@link IMaterializedReadModels} for working with materialized read model instances from the sink.
     */
    readonly materialized: IMaterializedReadModels;

    /**
     * Registers all discovered read models.
     * @returns A promise that resolves when registration completes.
     */
    register(): Promise<void>;

    /**
     * Registers a specific read model type.
     * @param readModelType - The read model type to register.
     * @returns A promise that resolves when registration completes.
     */
    register<TReadModel>(readModelType: Constructor<TReadModel>): Promise<void>;

    /**
     * Gets a read model instance by key.
     * @param readModelType - The read model type to retrieve.
     * @param key - The read model key.
     * @param sessionId - Optional session identifier.
     * @returns The read model instance.
     */
    getInstanceById<TReadModel>(readModelType: Constructor<TReadModel>, key: string, sessionId?: string): Promise<TReadModel>;

    /**
     * Gets all instances of a read model.
     * @param readModelType - The read model type to retrieve.
     * @param eventCount - Optional maximum number of events to process.
     * @returns The read model instances.
     */
    getInstances<TReadModel>(readModelType: Constructor<TReadModel>, eventCount?: bigint): Promise<TReadModel[]>;

    /**
     * Gets snapshots for a read model instance by key.
     * @param readModelType - The read model type to retrieve snapshots for.
     * @param key - The read model key.
     * @returns The read model snapshots.
     */
    getSnapshotsById<TReadModel>(readModelType: Constructor<TReadModel>, key: string): Promise<ReadModelSnapshot<TReadModel>[]>;

    /**
     * Watches changes for a specific read model type.
     * @param readModelType - The read model type to observe.
     * @returns An async iterable of read model changes.
     */
    watch<TReadModel>(readModelType: Constructor<TReadModel>): AsyncIterable<ReadModelChangeset<TReadModel>>;

    /**
     * Dehydrates a read model session.
     * @param sessionId - The session identifier to dehydrate.
     * @param readModelType - The read model type.
     * @param key - The read model key.
     * @returns A promise that resolves when dehydration completes.
     */
    dehydrateSession<TReadModel>(sessionId: string, readModelType: Constructor<TReadModel>, key: string): Promise<void>;

    /**
     * Releases (decrypts) PII properties in a read model instance.
     * @param readModelType - The read model type.
     * @param instance - The read model instance with encrypted PII.
     * @returns The read model instance with decrypted PII values.
     */
    release<TReadModel>(readModelType: Constructor<TReadModel>, instance: TReadModel): Promise<TReadModel>;

    /**
     * Releases (decrypts) PII properties in multiple read model instances.
     * @param readModelType - The read model type.
     * @param instances - The read model instances with encrypted PII.
     * @returns The read model instances with decrypted PII values.
     */
    releaseMany<TReadModel>(readModelType: Constructor<TReadModel>, instances: TReadModel[]): Promise<TReadModel[]>;
}
