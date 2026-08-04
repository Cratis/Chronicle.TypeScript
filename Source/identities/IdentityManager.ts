// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { IIdentityManager } from './IIdentityManager';

/**
 * Implements {@link IIdentityManager} by proxying to the Chronicle Kernel over the client connection.
 */
export class IdentityManager implements IIdentityManager {
    /**
     * Creates a new {@link IdentityManager} instance.
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
    async rename(subject: string, name: string): Promise<void> {
        await this._connection.identities.renameIdentity({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            Subject: subject,
            Name: name
        });
    }
}
