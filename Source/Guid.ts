// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import crypto from 'crypto';
import type { Guid as ProtobufGuid } from '@cratis/chronicle.contracts';

const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const getString = (value: number): string => value.toString(16).padStart(2, '0');

/**
 * Represents a Guid according to RFC 4122.
 */
export class Guid {
    /** Represents the empty Guid. */
    static readonly empty = Guid.parse('00000000-0000-0000-0000-000000000000');

    private readonly _stringVersion: string;

    /**
     * Initializes a new instance of the {@link Guid} class.
     * @param bytes - The 16 bytes that represent the Guid.
     */
    constructor(readonly bytes: number[] | Uint8Array) {
        this._stringVersion = Guid.bytesToString(bytes);
    }

    /**
     * Creates a new random Guid.
     * @returns The created Guid.
     */
    static create(): Guid {
        const bytes = crypto.randomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        return new Guid(bytes);
    }

    /**
     * Parses a Guid string into a {@link Guid}.
     * @param guid - The string representation of the Guid.
     * @returns The parsed Guid.
     */
    static parse(guid: string): Guid {
        const bytes: number[] = [];
        guid.split('-').forEach((part, index) => {
            const normalizedBytes = Guid.parseBytesForPart(part, index);
            normalizedBytes.forEach(byte => bytes.push(parseInt(byte, 16)));
        });
        return new Guid(bytes);
    }

    /**
     * Checks whether a value is a valid Guid string.
     * @param value - The value to check.
     * @returns True if the value is a valid Guid string; otherwise false.
     */
    static isGuid(value: string): boolean {
        return guidRegex.test(value);
    }

    /**
     * Parses a string input to Guid, or passes Guid input through.
     * @param input - A Guid string or Guid instance.
     * @returns A Guid instance.
     */
    static as(input: string | Guid): Guid {
        return typeof input === 'string' ? Guid.parse(input) : input;
    }

    /**
     * Converts to the protobuf Guid shape expected by the contracts package.
     * @returns The converted protobuf Guid value.
     */
    toProtobuf(): ProtobufGuid {
        const hex = this._stringVersion.replace(/-/g, '');
        const hi = BigInt(`0x${hex.substring(0, 16)}`);
        const lo = BigInt(`0x${hex.substring(16, 32)}`);

        return {
            hi: Number(BigInt.asIntN(32, hi >> BigInt(32))) * 0x100000000 + Number(hi & BigInt(0xFFFFFFFF)),
            lo: Number(BigInt.asIntN(32, lo >> BigInt(32))) * 0x100000000 + Number(lo & BigInt(0xFFFFFFFF))
        };
    }

    /**
     * Gets the string representation of the Guid.
     * @returns The Guid string.
     */
    toString(): string {
        return this._stringVersion;
    }

    /**
     * Converts the Guid to JSON.
     * @returns The JSON-serialized Guid string.
     */
    toJSON(): string {
        return this._stringVersion;
    }

    private static bytesToString(bytes: number[] | Uint8Array): string {
        return '' +
            getString(bytes[3]) + getString(bytes[2]) + getString(bytes[1]) + getString(bytes[0]) +
            '-' +
            getString(bytes[5]) + getString(bytes[4]) +
            '-' +
            getString(bytes[7]) + getString(bytes[6]) +
            '-' +
            getString(bytes[8]) + getString(bytes[9]) +
            '-' +
            getString(bytes[10]) + getString(bytes[11]) + getString(bytes[12]) + getString(bytes[13]) + getString(bytes[14]) + getString(bytes[15]);
    }

    private static parseBytesForPart(part: string, index: number): string[] {
        const bytesInPart = part.match(/.{1,2}/g) ?? [];
        // The first three Guid parts are little-endian according to RFC 4122 binary layout.
        return index < 3 ? bytesInPart.reverse() : bytesInPart;
    }
}
