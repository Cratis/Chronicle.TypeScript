// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { CallOptions } from 'nice-grpc-common';

/**
 * Request to release (decrypt) PII properties in a read model.
 * 
 * Note: These types mirror the compliance contracts until they are exported
 * from @cratis/chronicle.contracts package.
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

/**
 * Message functions placeholder - not needed for nice-grpc client creation
 */
export const ReleaseRequestFns = {} as any;
export const ReleaseResponseFns = {} as any;

/**
 * Compliance service definition for nice-grpc.
 */
export const ComplianceDefinition = {
    name: 'Compliance',
    fullName: 'Cratis.Chronicle.Contracts.Compliance.Compliance',
    methods: {
        release: {
            name: 'Release',
            requestType: ReleaseRequestFns,
            requestStream: false as const,
            responseType: ReleaseResponseFns,
            responseStream: false as const,
            options: {}
        }
    }
} as const;
