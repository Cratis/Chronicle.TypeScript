// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Resolver } from 'dns/promises';
import type { ChronicleServerAddress } from './ChronicleConnectionString';
import { ChronicleSrvResolutionError } from './ChronicleSrvResolutionError';

const DEFAULT_DNS_PORT = 53;

/**
 * Resolves Chronicle server addresses from DNS SRV records for `chronicle+srv://`
 * connection strings, querying `_chronicle._tcp.<host>` the same way the .NET reference
 * client does. Every call performs a fresh DNS query - results are never cached here, so
 * that reconnects always pick up membership changes.
 */
export class ChronicleSrvResolver {
    /**
     * Initializes a new instance of {@link ChronicleSrvResolver}.
     * @param _createResolver - Factory creating the `dns.promises.Resolver` used for each
     * resolution. Overridable for testing; defaults to a fresh `Resolver` per call.
     */
    constructor(private readonly _createResolver: () => Resolver = () => new Resolver()) {}

    /**
     * Resolves the SRV records for a `chronicle+srv://` host.
     * @param host - The host portion of the `chronicle+srv://` connection string.
     * @param nameServer - Optional `host[:port]` DNS name server to query instead of the
     * system default. Defaults to port 53 when no port is given.
     * @returns The resolved addresses, sorted ascending by priority and then descending by
     * weight, per RFC 2782.
     */
    async resolve(host: string, nameServer?: string): Promise<ChronicleServerAddress[]> {
        const resolver = this._createResolver();

        if (nameServer) {
            resolver.setServers([this.withDefaultPort(nameServer)]);
        }

        const name = `_chronicle._tcp.${host}`;
        const records = await resolver.resolveSrv(name);

        if (records.length === 0) {
            throw new ChronicleSrvResolutionError(name);
        }

        return records
            .slice()
            .sort((first, second) => first.priority - second.priority || second.weight - first.weight)
            // SRV targets are frequently returned as FQDNs with a trailing root '.'.
            .map(record => ({ host: record.name.replace(/\.$/, ''), port: record.port }));
    }

    private withDefaultPort(nameServer: string): string {
        const colonIndex = nameServer.lastIndexOf(':');
        return colonIndex === -1 ? `${nameServer}:${DEFAULT_DNS_PORT}` : nameServer;
    }
}
