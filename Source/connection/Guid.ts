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

    return {
        lo,
        hi
    };
}

/**
 * Converts a protobuf-net bcl.Guid from the contracts package into a Chronicle Guid.
 * The reverse of {@link toContractsGuid}.
 */
export function fromContractsGuid(guid: ContractsGuid | undefined): FundamentalGuid {
    if (!guid) {
        return FundamentalGuid.empty;
    }

    const bytes = new Array<number>(16).fill(0);
    for (let index = 0; index < 8; index++) {
        bytes[index] = Number((guid.lo >> BigInt(index * 8)) & 0xffn);
        bytes[index + 8] = Number((guid.hi >> BigInt(index * 8)) & 0xffn);
    }

    return new FundamentalGuid(bytes);
}