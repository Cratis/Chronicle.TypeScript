// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { RegistrationState } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import type { createLogger } from '../logging/createLogger.js';
import { ProjectionRegistrationNotApplied } from './ProjectionRegistrationNotApplied.js';

const unimplemented = 12;

/** How long to wait for a kernel to apply an accepted registration before leaving it to the kernel, in milliseconds. */
export const maxWaitForAcceptedRegistration = 5 * 60 * 1000;

/**
 * Waits until the kernel has applied what it accepted from a registrant.
 *
 * The kernel accepts a registration and answers at once; applying it happens in the background. Waiting with short
 * calls, instead of one long call, keeps a busy kernel from timing the client out. The wait is bounded, and when it
 * ends the registration is still the kernel's to apply. A kernel that applies registrations before it answers, or that
 * predates the registration status, has nothing to wait for.
 * @param connection - The Chronicle connection.
 * @param eventStore - The event store the registration was made in.
 * @param registrant - The registrant the registration was made as; with none there is nothing to wait for.
 * @param logger - The logger to report with.
 * @param maxWaitMs - How long to wait before leaving the registration to the kernel.
 * @throws {ProjectionRegistrationNotApplied} When the kernel accepted the registration but could not apply it.
 */
export async function waitForAcceptedRegistration(
    connection: ChronicleConnection,
    eventStore: string,
    registrant: string | undefined,
    logger: ReturnType<typeof createLogger>,
    maxWaitMs = maxWaitForAcceptedRegistration
): Promise<void> {
    if (!registrant) return;
    let delay = 50;
    let waited = 0;
    for (;;) {
        let status;
        try {
            status = await connection.projections.getRegistrationStatus({ EventStore: eventStore, Registrant: registrant });
        } catch (error) {
            if ((error as { code?: number })?.code === unimplemented) return;
            throw error;
        }
        if (!status) return;
        if (status.State === RegistrationState.Applied) return;
        if (status.State === RegistrationState.Failed) throw new ProjectionRegistrationNotApplied(registrant, status.Failure ?? '');
        if (waited >= maxWaitMs) {
            logger.warn('The kernel is still applying the projection registration; continuing without waiting for it', { registrant, maxWaitMs });
            return;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        waited += delay;
        delay = Math.min(delay * 2, 2000);
    }
}
