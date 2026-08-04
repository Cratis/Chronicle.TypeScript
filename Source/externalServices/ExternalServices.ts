// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { ExternalServiceBuilder } from './ExternalServiceBuilder';
import { IExternalServiceBuilder } from './IExternalServiceBuilder';
import { IExternalServices } from './IExternalServices';

/**
 * Implements {@link IExternalServices}.
 */
export class ExternalServices implements IExternalServices {
    /**
     * Creates a new {@link ExternalServices} instance.
     * @param _eventStore - Event store name.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async register(name: string, configure: (builder: IExternalServiceBuilder) => void): Promise<void> {
        const builder = new ExternalServiceBuilder();
        configure(builder);
        const definition = builder.build(name, name);

        await this._connection.externalServices.add({
            EventStore: this._eventStore,
            ExternalServices: [definition]
        });
    }
}
