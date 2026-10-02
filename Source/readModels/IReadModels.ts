// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IMaterializedReadModels } from './IMaterializedReadModels.js';
import type { IReadModelWatcher } from './IReadModelWatcher.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';
import type { ReadModelWatchOptions } from './ReadModelWatchOptions.js';
import type { ReadModelSnapshot } from './ReadModelSnapshot.js';

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
     * @returns The read model instance. When the kernel returns an empty document for a missing key,
     * returns a prototype-only instance; a JSON `null` document may construct a model with default fields.
     * Use {@link findInstanceById} when absence must be distinguished from stored data.
     */
    getInstanceById<TReadModel>(readModelType: Constructor<TReadModel>, key: string, sessionId?: string): Promise<TReadModel>;

    /**
     * Finds a read model instance by key.
     * @param readModelType - The read model type to retrieve.
     * @param key - The read model key.
     * @param sessionId - Optional session identifier.
     * @returns The read model instance, or null when no instance exists for the key.
     */
    findInstanceById<TReadModel>(readModelType: Constructor<TReadModel>, key: string, sessionId?: string): Promise<TReadModel | null>;

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
     * @returns An async iterable of read model changes. Transport failures reject iteration.
     * @remarks Keeps its original return type so existing watch implementations and mocks can
     * return plain async iterables. Use createWatcher for readiness and lifetime controls.
     */
    watch<TReadModel>(readModelType: Constructor<TReadModel>): AsyncIterable<ReadModelChangeset<TReadModel>>;

    /**
     * Starts a single-consumer watcher immediately, without requiring iteration for readiness.
     * @param readModelType - The read model type to observe.
     * @param options - Cancellation, opt-in resumption, and an optional overflow-failure limit.
     * @returns A watcher with subscription readiness, resubscription callbacks, and explicit disposal.
     * Transport failures reject iteration unless resume is true or an onResubscribed callback
     * is registered. Resumed watches retain received changes but do not replay outage gaps.
     */
    createWatcher<TReadModel>(readModelType: Constructor<TReadModel>, options?: ReadModelWatchOptions): IReadModelWatcher<TReadModel>;

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

    /**
     * Releases PII in a raw stored document using its __subject and per-property __subjects metadata.
     * Each __subjects key names a top-level property and overrides the default for its entire subtree.
     * Properties without either subject are copied unchanged; id and @subject() are not fallbacks.
     * @param readModelType - The discovered read model type supplying the schema.
     * @param document - A JSON document, with optional non-empty string __subject and a __subjects map of property names to non-empty strings.
     * @returns A new plain document containing only schema-declared top-level properties, without __subject or __subjects.
     * The input is never mutated. This does not construct a typed read model instance.
     * @throws If metadata is invalid, a subject property is absent from the document or schema, any release fails,
     * or a response is malformed, incomplete, or conflicts with another property's group. No partial result is returned.
     * @remarks Kernel per-property decryption failures that return HasError: false cannot be detected:
     * https://github.com/Cratis/Chronicle/issues/4480.
     */
    releaseDocument<TReadModel>(readModelType: Constructor<TReadModel>, document: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>>;
}
