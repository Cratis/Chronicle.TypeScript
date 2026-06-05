// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BinaryReader, BinaryWriter } from '@bufbuild/protobuf/wire';
import type { CallOptions } from 'nice-grpc-common';

/**
 * Request to release (decrypt) PII properties in a read model.
 */
export interface ReleaseRequest {
    EventStore: string;
    Namespace: string;
    Subject: string;
    Schema: string;
    Payload: string;
}

/**
 * Response from releasing PII properties.
 */
export interface ReleaseResponse {
    Payload: string;
    HasError: boolean;
    Error: string;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | bigint | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;

/**
 * Compliance service client interface.
 */
export interface ComplianceClient<CallOptionsExt = {}> {
    release(request: DeepPartial<ReleaseRequest>, options?: CallOptions & CallOptionsExt): Promise<ReleaseResponse>;
}

export const ReleaseRequest = {
    encode(message: ReleaseRequest, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.EventStore !== '') {
            writer.uint32(10).string(message.EventStore);
        }
        if (message.Namespace !== '') {
            writer.uint32(18).string(message.Namespace);
        }
        if (message.Subject !== '') {
            writer.uint32(26).string(message.Subject);
        }
        if (message.Schema !== '') {
            writer.uint32(34).string(message.Schema);
        }
        if (message.Payload !== '') {
            writer.uint32(42).string(message.Payload);
        }
        return writer;
    },

    decode(input: BinaryReader | Uint8Array, length?: number): ReleaseRequest {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message: ReleaseRequest = { EventStore: '', Namespace: '', Subject: '', Schema: '', Payload: '' };
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.EventStore = reader.string(); continue;
                case 2: message.Namespace = reader.string(); continue;
                case 3: message.Subject = reader.string(); continue;
                case 4: message.Schema = reader.string(); continue;
                case 5: message.Payload = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },

    fromPartial(object: DeepPartial<ReleaseRequest>): ReleaseRequest {
        return {
            EventStore: object.EventStore ?? '',
            Namespace: object.Namespace ?? '',
            Subject: object.Subject ?? '',
            Schema: object.Schema ?? '',
            Payload: object.Payload ?? ''
        };
    }
};

export const ReleaseResponse = {
    encode(message: ReleaseResponse, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Payload !== '') {
            writer.uint32(10).string(message.Payload);
        }
        if (message.HasError !== false) {
            writer.uint32(16).bool(message.HasError);
        }
        if (message.Error !== '') {
            writer.uint32(26).string(message.Error);
        }
        return writer;
    },

    decode(input: BinaryReader | Uint8Array, length?: number): ReleaseResponse {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message: ReleaseResponse = { Payload: '', HasError: false, Error: '' };
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Payload = reader.string(); continue;
                case 2: message.HasError = reader.bool(); continue;
                case 3: message.Error = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },

    fromPartial(object: DeepPartial<ReleaseResponse>): ReleaseResponse {
        return {
            Payload: object.Payload ?? '',
            HasError: object.HasError ?? false,
            Error: object.Error ?? ''
        };
    }
};

/**
 * Compliance service definition for nice-grpc.
 */
export const ComplianceDefinition = {
    name: 'Compliance',
    fullName: 'Cratis.Chronicle.Contracts.Compliance.Compliance',
    methods: {
        release: {
            name: 'Release',
            requestType: ReleaseRequest,
            requestStream: false as const,
            responseType: ReleaseResponse,
            responseStream: false as const,
            options: {}
        }
    }
} as const;
