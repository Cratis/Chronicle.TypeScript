// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BinaryReader } from '@bufbuild/protobuf/wire';

/**
 * Reads the top-level varint fields of an encoded message, by field number. Length-delimited
 * fields are skipped. A field written more than once keeps every occurrence.
 */
export function readVarintFields(bytes: Uint8Array): Map<number, number[]> {
    const reader = new BinaryReader(bytes);
    const fields = new Map<number, number[]>();
    while (reader.pos < reader.len) {
        const tag = reader.uint32();
        const field = tag >>> 3;
        const wireType = tag & 7;
        if (wireType === 0) {
            fields.set(field, [...(fields.get(field) ?? []), reader.uint32()]);
        } else {
            reader.skip(wireType);
        }
    }
    return fields;
}
