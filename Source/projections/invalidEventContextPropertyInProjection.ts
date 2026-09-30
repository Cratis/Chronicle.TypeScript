// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { InvalidEventContextPropertyError } from './InvalidEventContextPropertyError.js';

/** Add projection and read-model context to a rejected event-context path. */
export function invalidEventContextPropertyInProjection(
    error: InvalidEventContextPropertyError,
    projectionName: string,
    readModelId: string
): Error {
    return new Error(`Invalid event context property '${error.propertyPath}' in projection '${projectionName}' (read model '${readModelId}').`, { cause: error });
}
