// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection/index.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { IObservers } from './IObservers.js';
import { ObserverInformation } from './ObserverInformation.js';
import { ObserverRemovalResult } from './ObserverRemovalResult.js';
import { toObserverInformation } from './toObserverInformation.js';
import { toObserverRemovalResult } from './toObserverRemovalResult.js';

/**
 * Implements {@link IObservers} by proxying to the Chronicle Kernel over the client connection.
 */
export class Observers implements IObservers {
    /**
     * Creates a new {@link Observers} instance.
     * @param _eventStore - Event store name.
     * @param _namespace - Event store namespace.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async getAll(): Promise<ObserverInformation[]> {
        const response = await this._connection.observers.getObservers({
            EventStore: this._eventStore,
            Namespace: this._namespace
        });

        return (response.items ?? []).map(observer => toObserverInformation(observer));
    }

    /** @inheritdoc */
    async remove(observerId: string): Promise<ObserverRemovalResult> {
        const response = await this._connection.observers.removeObserver({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ObserverId: observerId,
            EventSequenceId: EventSequenceId.eventLog.value
        });

        return toObserverRemovalResult(response);
    }
}
