// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/chronicle.contracts';

/**
 * Converts a UUID string to a {@link Guid} protobuf-net value with lo/hi encoding.
 * @param uuid - The UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000").
 * @returns The Guid with lo and hi fields.
 */
export function uuidToGuid(uuid: string): Guid {
    const hex = uuid.replace(/-/g, '');
    const hi = BigInt('0x' + hex.substring(0, 16));
    const lo = BigInt('0x' + hex.substring(16, 32));

    return {
        hi: Number(BigInt.asIntN(32, hi >> BigInt(32))) * 0x100000000 + Number(hi & BigInt(0xFFFFFFFF)),
        lo: Number(BigInt.asIntN(32, lo >> BigInt(32))) * 0x100000000 + Number(lo & BigInt(0xFFFFFFFF))
    };
}

/**
 * Generates a new random UUID string.
 * @returns A newly generated UUID v4 string.
 */
export function newUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.random() * 16 | 0;
        const value = character === 'x' ? random : (random & 0x3 | 0x8);
        return value.toString(16);
    });
}
