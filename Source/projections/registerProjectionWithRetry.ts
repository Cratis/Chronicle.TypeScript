// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ProjectionOwner, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { Metadata } from 'nice-grpc-common';
import type { ChronicleConnection } from '../connection/index.js';
import type { ProjectionRegistrationOutcome, ProjectionRegistrationResponse } from '../ArtifactRegistrationResult.js';
import type { createLogger } from '../logging/createLogger.js';
import { ProjectionRegistrationNotApplied } from './ProjectionRegistrationNotApplied.js';
import { waitForAcceptedRegistration } from './waitForAcceptedRegistration.js';

const unavailable = 14;

/** Reads how many seconds a busy kernel asked the client to wait, from the `retry-after` trailer of its answer. */
function retryAfterMilliseconds(trailer: Metadata | undefined): number | undefined {
    const seconds = Number(trailer?.get('retry-after'));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * Registers a projection with the kernel, retrying with a growing delay while the kernel reports a transient failure.
 *
 * A kernel that is too busy to take the registration answers UNAVAILABLE with a `retry-after` trailer; the retry then
 * waits as long as the kernel asked instead of the growing delay. When a registrant is given, the kernel accepts the
 * registration and applies it in the background, and this waits until it has been applied.
 * @param connection - The Chronicle connection.
 * @param eventStore - The event store name.
 * @param logger - The logger to report with.
 * @param projection - The projection definition to register.
 * @param identifier - The identifier of the projection, for reporting.
 * @param maxAttempts - The number of attempts before giving up.
 * @param record - Receives the actual kernel response or final underlying failure.
 * @param registrant - Who the registration is made as; the kernel then applies it in the background and this waits for that.
 * @returns The kernel acknowledgment, or undefined if no attempts were requested.
 */
export async function registerProjectionWithRetry(
    connection: ChronicleConnection,
    eventStore: string,
    logger: ReturnType<typeof createLogger>,
    projection: ProjectionDefinition,
    identifier: string,
    maxAttempts = 5,
    record: (outcome: ProjectionRegistrationOutcome) => void = () => {},
    registrant?: string
): Promise<ProjectionRegistrationResponse | undefined> {
    let delay = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let retryAfter: number | undefined;
        try {
            logger.info('Registering projection', { identifier, readModel: projection.ReadModel, attempt });
            const response = await connection.projections.register({
                EventStore: eventStore,
                Owner: ProjectionOwner.PROJECTION_OWNER_Client,
                Projections: [projection],
                ...(registrant ? { Registrant: registrant } : {})
            }, { onTrailer: trailer => { retryAfter = retryAfterMilliseconds(trailer); } });
            await waitForAcceptedRegistration(connection, eventStore, registrant, logger);
            logger.info('Projection registered successfully', { identifier });
            record({ identifier, state: 'successful', response });
            return response;
        } catch (error) {
            const msg = String(error);
            const isTransient = !(error instanceof ProjectionRegistrationNotApplied) && msg.includes('UNKNOWN') || msg.includes('UNAVAILABLE') || msg.includes('INTERNAL');
            if (!isTransient || attempt === maxAttempts) {
                record({ identifier, state: 'failed', error });
                throw new Error(`Failed to register projection '${identifier}' after ${attempt} attempt(s): ${msg}`);
            }
            const waitFor = (error as { code?: number })?.code === unavailable && retryAfter ? retryAfter : delay;
            logger.warn('Projection registration failed with transient error, retrying', {
                identifier,
                attempt,
                nextAttemptInMs: waitFor,
                error
            });
            await new Promise(resolve => setTimeout(resolve, waitFor));
            delay = Math.min(delay * 2, 15000);
        }
    }
    return undefined;
}
