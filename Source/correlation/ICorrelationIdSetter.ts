// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CorrelationId } from './CorrelationId';

/**
 * Defines the write side of a correlation identifier provider scoped to the active call context.
 */
export interface ICorrelationIdSetter {
    /**
     * Sets the current correlation identifier for the active call context.
     * @param correlationId - The {@link CorrelationId} to set.
     */
    setCurrent(correlationId: CorrelationId): void;

    /**
     * Clears the current correlation identifier for the active call context,
     * causing the next access to generate a new unique identifier.
     */
    clear(): void;
}
