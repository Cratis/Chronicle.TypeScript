// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { FailedPartition } from '../observation/FailedPartition';
import { JobId } from '../jobs/JobId';
import { ProjectionId } from './ProjectionId';
import { ProjectionQueryResult } from './ProjectionQueryResult';
import { ProjectionState } from './ProjectionState';

/**
 * Defines a system to work with projections, including discovery, registration and operating
 * on projections that are known to the Chronicle Kernel.
 */
export interface IProjections {
    /**
     * Discovers all projections from the registered client artifacts.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered projections with the Chronicle Kernel.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;

    /**
     * Check if there is a definition for a specific projection identifier.
     * @param projectionId - Identifier of the projection.
     * @returns True if it exists, false if not.
     */
    hasFor(projectionId: ProjectionId | string): boolean;

    /**
     * Check if there is a definition for the projection that maintains a specific read model.
     * @param readModelType - Type of read model to check for.
     * @returns True if it exists, false if not.
     */
    hasForModel(readModelType: Constructor): boolean;

    /**
     * Get the {@link ProjectionId} for the projection that maintains a specific read model.
     * @param readModelType - Type of read model to get for.
     * @returns The {@link ProjectionId} for the read model.
     * @remarks A model-bound projection has no projection type of its own - its read model type is the
     * only handle it has. A declarative projection is only resolvable here when it declares its
     * read model type explicitly (the second argument to the `projection()` decorator); one whose read
     * model is inferred at registration time cannot be resolved before `register()` has run.
     */
    getProjectionIdFor(readModelType: Constructor): ProjectionId;

    /**
     * Get the state of a specific projection.
     * @param projectionId - Identifier of the projection to get the state for.
     * @returns The {@link ProjectionState}.
     */
    getStateFor(projectionId: ProjectionId | string): Promise<ProjectionState>;

    /**
     * Get the state of the projection that maintains a specific read model.
     * @param readModelType - Type of read model to get the state for.
     * @returns The {@link ProjectionState}.
     */
    getStateForModel(readModelType: Constructor): Promise<ProjectionState>;

    /**
     * Get any failed partitions for the projection that maintains a specific read model.
     * @param readModelType - Type of read model to get for.
     * @returns Collection of {@link FailedPartition}, if any.
     */
    getFailedPartitionsForModel(readModelType: Constructor): Promise<FailedPartition[]>;

    /**
     * Replay a specific projection by its identifier.
     * @param projectionId - Identifier of the projection to replay.
     * @returns The {@link JobId} of the replay job that was started or resumed.
     */
    replay(projectionId: ProjectionId | string): Promise<JobId>;

    /**
     * Replay the projection that maintains a specific read model.
     * @param readModelType - Type of read model to replay the projection for.
     * @returns The {@link JobId} of the replay job that was started or resumed.
     */
    replayForModel(readModelType: Constructor): Promise<JobId>;

    /**
     * Query a projection declaration against the event log without registering it.
     * @param declaration - The Projection Declaration Language string to query.
     * @param eventSequenceId - Optional event sequence identifier to query. Defaults to `"event-log"`.
     * @returns A {@link ProjectionQueryResult} containing the resulting read model entries.
     * @remarks The declaration may omit the `=> ReadModelType` target - in that case the read model
     * schema is inferred from the events used in the projection. An inferred read model can never be
     * registered as a permanent projection; query-only declarations are exclusively for ad-hoc
     * exploration.
     */
    query(declaration: string, eventSequenceId?: string): Promise<ProjectionQueryResult>;
}
