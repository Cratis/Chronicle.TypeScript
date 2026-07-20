// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Thrown when a `chronicle+srv://` connection string's DNS zone publishes no SRV records
 * for the queried name.
 */
export class ChronicleSrvResolutionError extends Error {
    constructor(name: string) {
        super(`No SRV records found for '${name}'. Verify the DNS zone publishes _chronicle._tcp SRV records for this host.`);
        this.name = 'ChronicleSrvResolutionError';
    }
}
