// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid as ContractsGuid } from '@cratis/chronicle.contracts';
import { Guid as FundamentalGuid } from '@cratis/fundamentals';

export { Guid } from '@cratis/fundamentals';

/**
 * Converts a Chronicle Guid into the protobuf-net bcl.Guid shape used by the
 * contracts package.
 */
export function toContractsGuid(guid: FundamentalGuid): ContractsGuid {
    const bytes = guid.bytes ?? FundamentalGuid.empty.bytes ?? [];
    if (bytes.length !== 16) {
        throw new Error(`Invalid Guid '${guid.toString()}'. Expected 16 bytes.`);
    }

    let lo = 0n;
    let hi = 0n;
    for (let index = 0; index < 8; index++) {
        lo |= BigInt(bytes[index]) << BigInt(index * 8);
        hi |= BigInt(bytes[index + 8]) << BigInt(index * 8);
    }

    // The runtime accepts strings for fixed64 values, which preserves the exact
    // 64-bit payload instead of truncating through Number.
    return {
        lo: lo.toString() as unknown as number,
        hi: hi.toString() as unknown as number
    };
}