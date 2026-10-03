// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { TransactionalEventRouting } from '../transactions/TransactionalEventRouting.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';
import { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import { IEventSequence } from './IEventSequence.js';
import { ITransactionalEventSequence } from './ITransactionalEventSequence.js';

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
    async append(eventSourceId: string, event: object, routing?: TransactionalEventRouting): Promise<void> {
        this.unitOfWork.addEvent(this._eventSequence.id, eventSourceId, event, routing);
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[], routing?: TransactionalEventRouting): Promise<void> {
        for (const event of events) {
            this.unitOfWork.addEvent(this._eventSequence.id, eventSourceId, event, routing);
        }
    }
}
