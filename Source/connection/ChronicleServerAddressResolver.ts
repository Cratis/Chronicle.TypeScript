// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleConnectionString, ChronicleServerAddress } from './ChronicleConnectionString';
import { ChronicleSrvResolver } from './ChronicleSrvResolver';

/**
 * Resolves the effective list of Chronicle server addresses for a connection string.
 * `chronicle+srv://` connection strings are resolved via DNS SRV lookup on every call;
 * plain `chronicle://` connection strings pass their parsed host list through unchanged
 * and never touch DNS.
 */
export class ChronicleServerAddressResolver {
    /**
     * Initializes a new instance of {@link ChronicleServerAddressResolver}.
     * @param _srvResolver - The SRV resolver used for `chronicle+srv://` connection strings.
     */
    constructor(private readonly _srvResolver: ChronicleSrvResolver = new ChronicleSrvResolver()) {}

    /**
     * Resolves the server addresses for a connection string.
     * @param connectionString - The connection string to resolve addresses for.
     * @returns The resolved addresses.
     */
    async resolve(connectionString: ChronicleConnectionString): Promise<ChronicleServerAddress[]> {
        if (!connectionString.isSrv) {
            return connectionString.serverAddresses;
        }

        const [srvHost] = connectionString.serverAddresses;
        return this._srvResolver.resolve(srvHost.host, connectionString.srvNameServer);
    }
}
