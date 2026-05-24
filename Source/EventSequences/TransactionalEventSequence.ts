// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IUnitOfWork } from '../Transactions/IUnitOfWork';
import { IUnitOfWorkManager } from '../Transactions/IUnitOfWorkManager';
import { IEventSequence } from './IEventSequence';
import { ITransactionalEventSequence } from './ITransactionalEventSequence';

/**
 * Implements {@link ITransactionalEventSequence} by delegating appends to the current unit of work.
 */
export class TransactionalEventSequence implements ITransactionalEventSequence {
    constructor(
        private readonly _eventSequence: IEventSequence,
        private readonly _unitOfWorkManager: IUnitOfWorkManager
    ) {}

    /** @inheritdoc */
    get unitOfWork(): IUnitOfWork {
        return this._unitOfWorkManager.current;
    }

    /** @inheritdoc */
    async append(eventSourceId: string, event: object): Promise<void> {
        this.unitOfWork.addEvent(this._eventSequence.id, eventSourceId, event);
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[]): Promise<void> {
        for (const event of events) {
            this.unitOfWork.addEvent(this._eventSequence.id, eventSourceId, event);
        }
    }
}
