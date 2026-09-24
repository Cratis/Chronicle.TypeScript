// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { CorrelationId } from './CorrelationId.js';
import { ICorrelationIdAccessor } from './ICorrelationIdAccessor.js';
import { ICorrelationIdSetter } from './ICorrelationIdSetter.js';

/**
 * Implements both {@link ICorrelationIdAccessor} and {@link ICorrelationIdSetter},
 * using {@link AsyncLocalStorage} to scope the correlation identifier to the active async call context.
 */
export class CorrelationIdManager implements ICorrelationIdAccessor, ICorrelationIdSetter {
    private readonly _storage = new AsyncLocalStorage<CorrelationId>();

    /** @inheritdoc */
    get current(): CorrelationId {
        return this._storage.getStore() ?? CorrelationId.create();
    }

    /** @inheritdoc */
    setCurrent(correlationId: CorrelationId): void {
        this._storage.enterWith(correlationId);
    }

    /** @inheritdoc */
    clear(): void {
        this._storage.enterWith(CorrelationId.create());
    }
}
