// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CorrelationId } from './CorrelationId';

/**
 * Defines the read side of a correlation identifier provider scoped to the active call context.
 */
export interface ICorrelationIdAccessor {
    /**
     * Gets the current correlation identifier for the active call context.
     * @returns The current {@link CorrelationId}.
     */
    readonly current: CorrelationId;
}
