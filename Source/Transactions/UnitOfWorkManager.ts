// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { Guid } from '@cratis/fundamentals';
import { IEventStore } from '../IEventStore';
import { IUnitOfWork } from './IUnitOfWork';
import { IUnitOfWorkManager } from './IUnitOfWorkManager';
import { NoUnitOfWorkHasBeenStarted } from './NoUnitOfWorkHasBeenStarted';
import { UnitOfWork } from './UnitOfWork';

/**
 * Implements {@link IUnitOfWorkManager} using {@link AsyncLocalStorage} for async-context scoping.
 */
export class UnitOfWorkManager implements IUnitOfWorkManager {
    private readonly _storage = new AsyncLocalStorage<IUnitOfWork | undefined>();
    private readonly _unitsOfWork = new Map<string, IUnitOfWork>();

    constructor(private readonly _eventStore: IEventStore) {}

    /** @inheritdoc */
    get current(): IUnitOfWork {
        return this._storage.getStore() ?? (() => {
            throw new NoUnitOfWorkHasBeenStarted();
        })();
    }

    /** @inheritdoc */
    get hasCurrent(): boolean {
        return this._storage.getStore() !== undefined;
    }

    /** @inheritdoc */
    tryGetFor(correlationId: string | Guid): IUnitOfWork | undefined {
        const key = Guid.as(correlationId).toString();
        return this._unitsOfWork.get(key);
    }

    /** @inheritdoc */
    begin(correlationId?: string | Guid): IUnitOfWork {
        const unitOfWork = new UnitOfWork(
            correlationId === undefined ? Guid.create() : Guid.as(correlationId),
            this.unitOfWorkCompleted.bind(this),
            this._eventStore
        );
        this.setCurrent(unitOfWork);
        return unitOfWork;
    }

    /** @inheritdoc */
    setCurrent(unitOfWork: IUnitOfWork): void {
        this._storage.enterWith(unitOfWork);
        this._unitsOfWork.set(unitOfWork.correlationId.toString(), unitOfWork);
        unitOfWork.onCompleted(this.unitOfWorkCompleted.bind(this));
    }

    private unitOfWorkCompleted(unitOfWork: IUnitOfWork): void {
        this._unitsOfWork.delete(unitOfWork.correlationId.toString());
        this._storage.enterWith(undefined);
    }
}
