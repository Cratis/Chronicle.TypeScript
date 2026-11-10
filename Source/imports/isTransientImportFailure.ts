// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClientError, Status } from 'nice-grpc-common';

const transientStatuses = new Set<Status>([Status.UNAVAILABLE, Status.DEADLINE_EXCEEDED, Status.RESOURCE_EXHAUSTED, Status.ABORTED, Status.INTERNAL]);

/**
 * Determines whether a failed call is worth sending again: the connection failed rather than the kernel refusing it.
 * @param error - What the call failed with.
 * @returns True when the call can be sent again.
 */
export function isTransientImportFailure(error: unknown): boolean {
    return error instanceof ClientError && transientStatuses.has(error.code);
}
