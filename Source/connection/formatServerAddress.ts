// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleServerAddress } from './ChronicleConnectionString';

/**
 * Formats a {@link ChronicleServerAddress} as a `host:port` string, wrapping IPv6 host
 * literals in bracket notation (e.g. `[::1]:35000`) as required by both the connection
 * string grammar and gRPC target grammar.
 * @param address - The address to format.
 * @returns The formatted `host:port` string.
 */
export function formatServerAddress(address: ChronicleServerAddress): string {
    const host = address.host.includes(':') ? `[${address.host}]` : address.host;
    return `${host}:${address.port}`;
}
