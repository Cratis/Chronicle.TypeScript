// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { IUnitOfWork } from './IUnitOfWork';

/**
 * Defines an API for managing units of work in the active async context.
 */
export interface IUnitOfWorkManager {
    /** The current unit of work for the active async context. */
    readonly current: IUnitOfWork;

    /** Whether there is a current unit of work for the active async context. */
    readonly hasCurrent: boolean;

    /**
     * Tries to get a unit of work by correlation identifier.
     * @param correlationId - Correlation identifier to look up.
     * @returns The unit of work if found; otherwise undefined.
     */
    tryGetFor(correlationId: string | Guid): IUnitOfWork | undefined;

    /**
     * Begins a new unit of work in the active async context.
     * @param correlationId - Optional correlation identifier. A new one is generated if omitted.
     * @returns The created unit of work.
     */
    begin(correlationId?: string | Guid): IUnitOfWork;

    /**
     * Sets the current unit of work for the active async context.
     * @param unitOfWork - The unit of work to set as current.
     */
    setCurrent(unitOfWork: IUnitOfWork): void;
}
