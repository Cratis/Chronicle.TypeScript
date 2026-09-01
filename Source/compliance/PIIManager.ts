// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { IPIIManager } from './IPIIManager';

/**
 * Implements {@link IPIIManager} by proxying to the Chronicle Kernel over the client connection.
 */
export class PIIManager implements IPIIManager {
    /**
     * Creates a new {@link PIIManager} instance.
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
    async deleteEncryptionKey(identifier: string): Promise<void> {
        await this._connection.compliance.deleteEncryptionKey({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            Identifier: identifier
        });
    }

    /** @inheritdoc */
    async allowNewEncryptionKeyFor(identifier: string): Promise<void> {
        await this._connection.compliance.allowNewEncryptionKey({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            Identifier: identifier
        });
    }
}
