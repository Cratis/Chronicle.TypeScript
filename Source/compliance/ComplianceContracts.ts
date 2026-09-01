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

/**
 * Request to delete the encryption key for a PII encryption key identifier (GDPR right-to-erasure).
 */
export interface DeleteEncryptionKeyRequest {
    EventStore: string;
    Namespace: string;
    Identifier: string;
}

/**
 * Request to authorize a new encryption key for a PII encryption key identifier whose key was
 * previously erased, so a later lawful lifecycle can protect their data again.
 */
export interface AllowNewEncryptionKeyRequest {
    EventStore: string;
    Namespace: string;
    Identifier: string;
}

/**
 * An empty protobuf message.
 */
export interface Empty {}

type Builtin = Date | Function | Uint8Array | string | number | boolean | bigint | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;

/**
 * Compliance service client interface.
 */
export interface ComplianceClient<CallOptionsExt = {}> {
    release(request: DeepPartial<ReleaseRequest>, options?: CallOptions & CallOptionsExt): Promise<ReleaseResponse>;
    deleteEncryptionKey(request: DeepPartial<DeleteEncryptionKeyRequest>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
    allowNewEncryptionKey(request: DeepPartial<AllowNewEncryptionKeyRequest>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
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

export const DeleteEncryptionKeyRequest = {
    encode(message: DeleteEncryptionKeyRequest, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.EventStore !== '') {
            writer.uint32(10).string(message.EventStore);
        }
        if (message.Namespace !== '') {
            writer.uint32(18).string(message.Namespace);
        }
        if (message.Identifier !== '') {
            writer.uint32(26).string(message.Identifier);
        }
        return writer;
    },

    decode(input: BinaryReader | Uint8Array, length?: number): DeleteEncryptionKeyRequest {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message: DeleteEncryptionKeyRequest = { EventStore: '', Namespace: '', Identifier: '' };
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.EventStore = reader.string(); continue;
                case 2: message.Namespace = reader.string(); continue;
                case 3: message.Identifier = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },

    fromPartial(object: DeepPartial<DeleteEncryptionKeyRequest>): DeleteEncryptionKeyRequest {
        return {
            EventStore: object.EventStore ?? '',
            Namespace: object.Namespace ?? '',
            Identifier: object.Identifier ?? ''
        };
    }
};

export const AllowNewEncryptionKeyRequest = {
    encode(message: AllowNewEncryptionKeyRequest, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.EventStore !== '') {
            writer.uint32(10).string(message.EventStore);
        }
        if (message.Namespace !== '') {
            writer.uint32(18).string(message.Namespace);
        }
        if (message.Identifier !== '') {
            writer.uint32(26).string(message.Identifier);
        }
        return writer;
    },

    decode(input: BinaryReader | Uint8Array, length?: number): AllowNewEncryptionKeyRequest {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message: AllowNewEncryptionKeyRequest = { EventStore: '', Namespace: '', Identifier: '' };
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.EventStore = reader.string(); continue;
                case 2: message.Namespace = reader.string(); continue;
                case 3: message.Identifier = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },

    fromPartial(object: DeepPartial<AllowNewEncryptionKeyRequest>): AllowNewEncryptionKeyRequest {
        return {
            EventStore: object.EventStore ?? '',
            Namespace: object.Namespace ?? '',
            Identifier: object.Identifier ?? ''
        };
    }
};

export const Empty = {
    encode(_: Empty, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        return writer;
    },

    decode(input: BinaryReader | Uint8Array, length?: number): Empty {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        while (reader.pos < end) {
            const tag = reader.uint32();
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return {};
    },

    fromPartial(_: DeepPartial<Empty>): Empty {
        return {};
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
        },
        deleteEncryptionKey: {
            name: 'DeleteEncryptionKey',
            requestType: DeleteEncryptionKeyRequest,
            requestStream: false as const,
            responseType: Empty,
            responseStream: false as const,
            options: {}
        },
        allowNewEncryptionKey: {
            name: 'AllowNewEncryptionKey',
            requestType: AllowNewEncryptionKeyRequest,
            requestStream: false as const,
            responseType: Empty,
            responseStream: false as const,
            options: {}
        }
    }
} as const;
