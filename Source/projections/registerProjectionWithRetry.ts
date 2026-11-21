// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ProjectionOwner, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../connection/index.js';
import type { ProjectionRegistrationOutcome, ProjectionRegistrationResponse } from '../ArtifactRegistrationResult.js';
import type { createLogger } from '../logging/createLogger.js';

/**
 * Registers a projection with the kernel, retrying with a growing delay while the kernel reports a transient failure.
 * @param connection - The Chronicle connection.
 * @param eventStore - The event store name.
 * @param logger - The logger to report with.
 * @param projection - The projection definition to register.
 * @param identifier - The identifier of the projection, for reporting.
 * @param maxAttempts - The number of attempts before giving up.
 * @param record - Receives the actual kernel response or final underlying failure.
 * @returns The kernel acknowledgment, or undefined if no attempts were requested.
 */
export async function registerProjectionWithRetry(
    connection: ChronicleConnection,
    eventStore: string,
    logger: ReturnType<typeof createLogger>,
    projection: ProjectionDefinition,
    identifier: string,
    maxAttempts = 5,
    record: (outcome: ProjectionRegistrationOutcome) => void = () => {}
): Promise<ProjectionRegistrationResponse | undefined> {
    let delay = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            logger.info('Registering projection', { identifier, readModel: projection.ReadModel, attempt });
            const response = await connection.projections.register({
                EventStore: eventStore,
                Owner: ProjectionOwner.PROJECTION_OWNER_Client,
                Projections: [projection]
            });
            logger.info('Projection registered successfully', { identifier });
            record({ identifier, state: 'successful', response });
            return response;
        } catch (error) {
            const msg = String(error);
            const isTransient = msg.includes('UNKNOWN') || msg.includes('UNAVAILABLE') || msg.includes('INTERNAL');
            if (!isTransient || attempt === maxAttempts) {
                record({ identifier, state: 'failed', error });
                throw new Error(`Failed to register projection '${identifier}' after ${attempt} attempt(s): ${msg}`);
            }
            logger.warn('Projection registration failed with transient error, retrying', {
                identifier,
                attempt,
                nextAttemptInMs: delay,
                error
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, 15000);
        }
    }
    return undefined;
}
