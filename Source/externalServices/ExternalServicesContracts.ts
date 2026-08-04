// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BinaryReader, BinaryWriter } from '@bufbuild/protobuf/wire';
import type { CallOptions } from 'nice-grpc-common';

// The generated `@cratis/chronicle.contracts` package does not (yet) re-export its
// `externalservices` proto module from its public barrel, so the wire types are mirrored
// here - the same approach used for `Source/compliance/ComplianceContracts.ts` and
// `Source/eventStoreSubscriptions/contracts.ts`.

/**
 * The type of endpoint an external service exposes.
 */
export enum ExternalServiceEndpointType {
    Http = 0,
    MsSql = 1,
    PostgreSql = 2
}

/**
 * Basic authentication credentials for an HTTP endpoint.
 */
export interface BasicAuthorization {
    Username: string;
    Password: string;
}

/**
 * A bearer token for an HTTP endpoint.
 */
export interface BearerTokenAuthorization {
    Token: string;
}

/**
 * OAuth client credentials for an HTTP endpoint.
 */
export interface OAuthAuthorization {
    Authority: string;
    ClientId: string;
    ClientSecret: string;
}

/**
 * The authorization configured for an HTTP endpoint - at most one of the three is set.
 */
export interface OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
    Value0: BasicAuthorization | undefined;
    Value1: BearerTokenAuthorization | undefined;
    Value2: OAuthAuthorization | undefined;
}

/**
 * Configuration for an HTTP-based external service endpoint.
 */
export interface HttpEndpointConfiguration {
    Url: string;
    Authorization: OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization | undefined;
    Headers: { [key: string]: string };
}

/**
 * Configuration for a database-based external service endpoint.
 */
export interface DatabaseEndpointConfiguration {
    Host: string;
    Port: number;
    Database: string;
    Username: string;
    Password: string;
    Options: { [key: string]: string };
}

/**
 * The endpoint configured for an external service - either Http or Database, based on Type.
 */
export interface ExternalServiceEndpoint {
    Type: ExternalServiceEndpointType;
    Http: HttpEndpointConfiguration | undefined;
    Database: DatabaseEndpointConfiguration | undefined;
}

/**
 * The definition of an external service registration.
 */
export interface ExternalServiceDefinition {
    Id: string;
    Name: string;
    Endpoint: ExternalServiceEndpoint | undefined;
}

/**
 * Request for registering external services with the Kernel.
 */
export interface AddExternalServices {
    EventStore: string;
    ExternalServices: ExternalServiceDefinition[];
}

/**
 * An empty protobuf message.
 */
export interface Empty {}

type Builtin = Date | Function | Uint8Array | string | number | boolean | bigint | undefined;
export type DeepPartial<T> = T extends Builtin ? T
    : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
    : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;

interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: unknown): T;
    toJSON(message: T): unknown;
    create(base?: DeepPartial<T>): T;
    fromPartial(object: DeepPartial<T>): T;
}

function isSet(value: unknown): boolean {
    return value !== null && value !== undefined;
}

interface StringMapEntry {
    key: string;
    value: string;
}

function encodeStringMapEntry(entry: StringMapEntry, writer: BinaryWriter): BinaryWriter {
    if (entry.key !== '') {
        writer.uint32(10).string(entry.key);
    }
    if (entry.value !== '') {
        writer.uint32(18).string(entry.value);
    }
    return writer;
}

function decodeStringMapEntry(reader: BinaryReader, length: number): StringMapEntry {
    const end = reader.pos + length;
    const entry: StringMapEntry = { key: '', value: '' };
    while (reader.pos < end) {
        const tag = reader.uint32();
        switch (tag >>> 3) {
            case 1: entry.key = reader.string(); continue;
            case 2: entry.value = reader.string(); continue;
        }
        if ((tag & 7) === 4 || tag === 0) break;
        reader.skip(tag & 7);
    }
    return entry;
}

function encodeStringMap(map: { [key: string]: string }, writer: BinaryWriter, fieldNumber: number): void {
    for (const [key, value] of Object.entries(map)) {
        encodeStringMapEntry({ key, value }, writer.uint32((fieldNumber << 3) | 2).fork()).join();
    }
}

function decodeStringMapEntryInto(reader: BinaryReader, map: { [key: string]: string }): void {
    const entry = decodeStringMapEntry(reader, reader.uint32());
    map[entry.key] = entry.value;
}

function stringMapFromJSON(value: unknown): { [key: string]: string } {
    if (typeof value !== 'object' || value === null) {
        return {};
    }
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, String(entryValue)]));
}

function stringMapFromPartial(value: { [key: string]: string } | undefined): { [key: string]: string } {
    return Object.entries(value ?? {}).reduce((accumulator: { [key: string]: string }, [key, entryValue]) => {
        if (entryValue !== undefined) {
            accumulator[key] = entryValue;
        }
        return accumulator;
    }, {});
}

export const EmptyMessage: MessageFns<Empty> = {
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
    fromJSON(_: unknown): Empty {
        return {};
    },
    toJSON(_: Empty): unknown {
        return {};
    },
    create(base?: DeepPartial<Empty>): Empty {
        return EmptyMessage.fromPartial(base ?? {});
    },
    fromPartial(_: DeepPartial<Empty>): Empty {
        return {};
    }
};

function createBaseBasicAuthorization(): BasicAuthorization {
    return { Username: '', Password: '' };
}

export const BasicAuthorizationMessage: MessageFns<BasicAuthorization> = {
    encode(message: BasicAuthorization, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Username !== '') writer.uint32(10).string(message.Username);
        if (message.Password !== '') writer.uint32(18).string(message.Password);
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): BasicAuthorization {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseBasicAuthorization();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Username = reader.string(); continue;
                case 2: message.Password = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): BasicAuthorization {
        const value = object as { Username?: unknown; Password?: unknown };
        return {
            Username: typeof value.Username === 'string' ? value.Username : '',
            Password: typeof value.Password === 'string' ? value.Password : ''
        };
    },
    toJSON(message: BasicAuthorization): unknown {
        return { Username: message.Username, Password: message.Password };
    },
    create(base?: DeepPartial<BasicAuthorization>): BasicAuthorization {
        return BasicAuthorizationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<BasicAuthorization>): BasicAuthorization {
        return { Username: object.Username ?? '', Password: object.Password ?? '' };
    }
};

function createBaseBearerTokenAuthorization(): BearerTokenAuthorization {
    return { Token: '' };
}

export const BearerTokenAuthorizationMessage: MessageFns<BearerTokenAuthorization> = {
    encode(message: BearerTokenAuthorization, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Token !== '') writer.uint32(10).string(message.Token);
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): BearerTokenAuthorization {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseBearerTokenAuthorization();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Token = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): BearerTokenAuthorization {
        const value = object as { Token?: unknown };
        return { Token: typeof value.Token === 'string' ? value.Token : '' };
    },
    toJSON(message: BearerTokenAuthorization): unknown {
        return { Token: message.Token };
    },
    create(base?: DeepPartial<BearerTokenAuthorization>): BearerTokenAuthorization {
        return BearerTokenAuthorizationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<BearerTokenAuthorization>): BearerTokenAuthorization {
        return { Token: object.Token ?? '' };
    }
};

function createBaseOAuthAuthorization(): OAuthAuthorization {
    return { Authority: '', ClientId: '', ClientSecret: '' };
}

export const OAuthAuthorizationMessage: MessageFns<OAuthAuthorization> = {
    encode(message: OAuthAuthorization, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Authority !== '') writer.uint32(10).string(message.Authority);
        if (message.ClientId !== '') writer.uint32(18).string(message.ClientId);
        if (message.ClientSecret !== '') writer.uint32(26).string(message.ClientSecret);
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): OAuthAuthorization {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseOAuthAuthorization();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Authority = reader.string(); continue;
                case 2: message.ClientId = reader.string(); continue;
                case 3: message.ClientSecret = reader.string(); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): OAuthAuthorization {
        const value = object as { Authority?: unknown; ClientId?: unknown; ClientSecret?: unknown };
        return {
            Authority: typeof value.Authority === 'string' ? value.Authority : '',
            ClientId: typeof value.ClientId === 'string' ? value.ClientId : '',
            ClientSecret: typeof value.ClientSecret === 'string' ? value.ClientSecret : ''
        };
    },
    toJSON(message: OAuthAuthorization): unknown {
        return { Authority: message.Authority, ClientId: message.ClientId, ClientSecret: message.ClientSecret };
    },
    create(base?: DeepPartial<OAuthAuthorization>): OAuthAuthorization {
        return OAuthAuthorizationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<OAuthAuthorization>): OAuthAuthorization {
        return {
            Authority: object.Authority ?? '',
            ClientId: object.ClientId ?? '',
            ClientSecret: object.ClientSecret ?? ''
        };
    }
};

function createBaseOneOfAuthorization(): OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
    return { Value0: undefined, Value1: undefined, Value2: undefined };
}

export const OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage: MessageFns<OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization> = {
    encode(message: OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Value0 !== undefined) BasicAuthorizationMessage.encode(message.Value0, writer.uint32(10).fork()).join();
        if (message.Value1 !== undefined) BearerTokenAuthorizationMessage.encode(message.Value1, writer.uint32(18).fork()).join();
        if (message.Value2 !== undefined) OAuthAuthorizationMessage.encode(message.Value2, writer.uint32(26).fork()).join();
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseOneOfAuthorization();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Value0 = BasicAuthorizationMessage.decode(reader, reader.uint32()); continue;
                case 2: message.Value1 = BearerTokenAuthorizationMessage.decode(reader, reader.uint32()); continue;
                case 3: message.Value2 = OAuthAuthorizationMessage.decode(reader, reader.uint32()); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
        const value = object as { Value0?: unknown; Value1?: unknown; Value2?: unknown };
        return {
            Value0: isSet(value.Value0) ? BasicAuthorizationMessage.fromJSON(value.Value0) : undefined,
            Value1: isSet(value.Value1) ? BearerTokenAuthorizationMessage.fromJSON(value.Value1) : undefined,
            Value2: isSet(value.Value2) ? OAuthAuthorizationMessage.fromJSON(value.Value2) : undefined
        };
    },
    toJSON(message: OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization): unknown {
        return {
            Value0: message.Value0 !== undefined ? BasicAuthorizationMessage.toJSON(message.Value0) : undefined,
            Value1: message.Value1 !== undefined ? BearerTokenAuthorizationMessage.toJSON(message.Value1) : undefined,
            Value2: message.Value2 !== undefined ? OAuthAuthorizationMessage.toJSON(message.Value2) : undefined
        };
    },
    create(base?: DeepPartial<OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization>): OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
        return OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization>): OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization {
        return {
            Value0: object.Value0 !== undefined && object.Value0 !== null ? BasicAuthorizationMessage.fromPartial(object.Value0) : undefined,
            Value1: object.Value1 !== undefined && object.Value1 !== null ? BearerTokenAuthorizationMessage.fromPartial(object.Value1) : undefined,
            Value2: object.Value2 !== undefined && object.Value2 !== null ? OAuthAuthorizationMessage.fromPartial(object.Value2) : undefined
        };
    }
};

function createBaseHttpEndpointConfiguration(): HttpEndpointConfiguration {
    return { Url: '', Authorization: undefined, Headers: {} };
}

export const HttpEndpointConfigurationMessage: MessageFns<HttpEndpointConfiguration> = {
    encode(message: HttpEndpointConfiguration, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Url !== '') writer.uint32(10).string(message.Url);
        if (message.Authorization !== undefined) {
            OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.encode(message.Authorization, writer.uint32(18).fork()).join();
        }
        encodeStringMap(message.Headers, writer, 3);
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): HttpEndpointConfiguration {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseHttpEndpointConfiguration();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Url = reader.string(); continue;
                case 2: message.Authorization = OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.decode(reader, reader.uint32()); continue;
                case 3: decodeStringMapEntryInto(reader, message.Headers); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): HttpEndpointConfiguration {
        const value = object as { Url?: unknown; Authorization?: unknown; Headers?: unknown };
        return {
            Url: typeof value.Url === 'string' ? value.Url : '',
            Authorization: isSet(value.Authorization) ? OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.fromJSON(value.Authorization) : undefined,
            Headers: stringMapFromJSON(value.Headers)
        };
    },
    toJSON(message: HttpEndpointConfiguration): unknown {
        return {
            Url: message.Url,
            Authorization: message.Authorization !== undefined ? OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.toJSON(message.Authorization) : undefined,
            Headers: message.Headers
        };
    },
    create(base?: DeepPartial<HttpEndpointConfiguration>): HttpEndpointConfiguration {
        return HttpEndpointConfigurationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<HttpEndpointConfiguration>): HttpEndpointConfiguration {
        return {
            Url: object.Url ?? '',
            Authorization: object.Authorization !== undefined && object.Authorization !== null
                ? OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorizationMessage.fromPartial(object.Authorization)
                : undefined,
            Headers: stringMapFromPartial(object.Headers as { [key: string]: string } | undefined)
        };
    }
};

function createBaseDatabaseEndpointConfiguration(): DatabaseEndpointConfiguration {
    return { Host: '', Port: 0, Database: '', Username: '', Password: '', Options: {} };
}

export const DatabaseEndpointConfigurationMessage: MessageFns<DatabaseEndpointConfiguration> = {
    encode(message: DatabaseEndpointConfiguration, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Host !== '') writer.uint32(10).string(message.Host);
        if (message.Port !== 0) writer.uint32(16).int32(message.Port);
        if (message.Database !== '') writer.uint32(26).string(message.Database);
        if (message.Username !== '') writer.uint32(34).string(message.Username);
        if (message.Password !== '') writer.uint32(42).string(message.Password);
        encodeStringMap(message.Options, writer, 6);
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): DatabaseEndpointConfiguration {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseDatabaseEndpointConfiguration();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Host = reader.string(); continue;
                case 2: message.Port = reader.int32(); continue;
                case 3: message.Database = reader.string(); continue;
                case 4: message.Username = reader.string(); continue;
                case 5: message.Password = reader.string(); continue;
                case 6: decodeStringMapEntryInto(reader, message.Options); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): DatabaseEndpointConfiguration {
        const value = object as {
            Host?: unknown; Port?: unknown; Database?: unknown; Username?: unknown; Password?: unknown; Options?: unknown;
        };
        return {
            Host: typeof value.Host === 'string' ? value.Host : '',
            Port: typeof value.Port === 'number' ? value.Port : 0,
            Database: typeof value.Database === 'string' ? value.Database : '',
            Username: typeof value.Username === 'string' ? value.Username : '',
            Password: typeof value.Password === 'string' ? value.Password : '',
            Options: stringMapFromJSON(value.Options)
        };
    },
    toJSON(message: DatabaseEndpointConfiguration): unknown {
        return {
            Host: message.Host,
            Port: Math.round(message.Port),
            Database: message.Database,
            Username: message.Username,
            Password: message.Password,
            Options: message.Options
        };
    },
    create(base?: DeepPartial<DatabaseEndpointConfiguration>): DatabaseEndpointConfiguration {
        return DatabaseEndpointConfigurationMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<DatabaseEndpointConfiguration>): DatabaseEndpointConfiguration {
        return {
            Host: object.Host ?? '',
            Port: object.Port ?? 0,
            Database: object.Database ?? '',
            Username: object.Username ?? '',
            Password: object.Password ?? '',
            Options: stringMapFromPartial(object.Options as { [key: string]: string } | undefined)
        };
    }
};

function createBaseExternalServiceEndpoint(): ExternalServiceEndpoint {
    return { Type: ExternalServiceEndpointType.Http, Http: undefined, Database: undefined };
}

export const ExternalServiceEndpointMessage: MessageFns<ExternalServiceEndpoint> = {
    encode(message: ExternalServiceEndpoint, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Type !== ExternalServiceEndpointType.Http) writer.uint32(8).int32(message.Type);
        if (message.Http !== undefined) HttpEndpointConfigurationMessage.encode(message.Http, writer.uint32(18).fork()).join();
        if (message.Database !== undefined) DatabaseEndpointConfigurationMessage.encode(message.Database, writer.uint32(26).fork()).join();
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): ExternalServiceEndpoint {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseExternalServiceEndpoint();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Type = reader.int32(); continue;
                case 2: message.Http = HttpEndpointConfigurationMessage.decode(reader, reader.uint32()); continue;
                case 3: message.Database = DatabaseEndpointConfigurationMessage.decode(reader, reader.uint32()); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): ExternalServiceEndpoint {
        const value = object as { Type?: unknown; Http?: unknown; Database?: unknown };
        return {
            Type: typeof value.Type === 'number' ? value.Type : ExternalServiceEndpointType.Http,
            Http: isSet(value.Http) ? HttpEndpointConfigurationMessage.fromJSON(value.Http) : undefined,
            Database: isSet(value.Database) ? DatabaseEndpointConfigurationMessage.fromJSON(value.Database) : undefined
        };
    },
    toJSON(message: ExternalServiceEndpoint): unknown {
        return {
            Type: message.Type,
            Http: message.Http !== undefined ? HttpEndpointConfigurationMessage.toJSON(message.Http) : undefined,
            Database: message.Database !== undefined ? DatabaseEndpointConfigurationMessage.toJSON(message.Database) : undefined
        };
    },
    create(base?: DeepPartial<ExternalServiceEndpoint>): ExternalServiceEndpoint {
        return ExternalServiceEndpointMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<ExternalServiceEndpoint>): ExternalServiceEndpoint {
        return {
            Type: object.Type ?? ExternalServiceEndpointType.Http,
            Http: object.Http !== undefined && object.Http !== null ? HttpEndpointConfigurationMessage.fromPartial(object.Http) : undefined,
            Database: object.Database !== undefined && object.Database !== null ? DatabaseEndpointConfigurationMessage.fromPartial(object.Database) : undefined
        };
    }
};

function createBaseExternalServiceDefinition(): ExternalServiceDefinition {
    return { Id: '', Name: '', Endpoint: undefined };
}

export const ExternalServiceDefinitionMessage: MessageFns<ExternalServiceDefinition> = {
    encode(message: ExternalServiceDefinition, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Id !== '') writer.uint32(10).string(message.Id);
        if (message.Name !== '') writer.uint32(18).string(message.Name);
        if (message.Endpoint !== undefined) ExternalServiceEndpointMessage.encode(message.Endpoint, writer.uint32(26).fork()).join();
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): ExternalServiceDefinition {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseExternalServiceDefinition();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.Id = reader.string(); continue;
                case 2: message.Name = reader.string(); continue;
                case 3: message.Endpoint = ExternalServiceEndpointMessage.decode(reader, reader.uint32()); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): ExternalServiceDefinition {
        const value = object as { Id?: unknown; Name?: unknown; Endpoint?: unknown };
        return {
            Id: typeof value.Id === 'string' ? value.Id : '',
            Name: typeof value.Name === 'string' ? value.Name : '',
            Endpoint: isSet(value.Endpoint) ? ExternalServiceEndpointMessage.fromJSON(value.Endpoint) : undefined
        };
    },
    toJSON(message: ExternalServiceDefinition): unknown {
        return {
            Id: message.Id,
            Name: message.Name,
            Endpoint: message.Endpoint !== undefined ? ExternalServiceEndpointMessage.toJSON(message.Endpoint) : undefined
        };
    },
    create(base?: DeepPartial<ExternalServiceDefinition>): ExternalServiceDefinition {
        return ExternalServiceDefinitionMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<ExternalServiceDefinition>): ExternalServiceDefinition {
        return {
            Id: object.Id ?? '',
            Name: object.Name ?? '',
            Endpoint: object.Endpoint !== undefined && object.Endpoint !== null ? ExternalServiceEndpointMessage.fromPartial(object.Endpoint) : undefined
        };
    }
};

function createBaseAddExternalServices(): AddExternalServices {
    return { EventStore: '', ExternalServices: [] };
}

export const AddExternalServicesMessage: MessageFns<AddExternalServices> = {
    encode(message: AddExternalServices, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.EventStore !== '') writer.uint32(10).string(message.EventStore);
        for (const externalService of message.ExternalServices) {
            ExternalServiceDefinitionMessage.encode(externalService, writer.uint32(18).fork()).join();
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): AddExternalServices {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseAddExternalServices();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.EventStore = reader.string(); continue;
                case 2: message.ExternalServices.push(ExternalServiceDefinitionMessage.decode(reader, reader.uint32())); continue;
            }
            if ((tag & 7) === 4 || tag === 0) break;
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): AddExternalServices {
        const value = object as { EventStore?: unknown; ExternalServices?: unknown[] };
        return {
            EventStore: typeof value.EventStore === 'string' ? value.EventStore : '',
            ExternalServices: Array.isArray(value.ExternalServices)
                ? value.ExternalServices.map(externalService => ExternalServiceDefinitionMessage.fromJSON(externalService))
                : []
        };
    },
    toJSON(message: AddExternalServices): unknown {
        return {
            EventStore: message.EventStore,
            ExternalServices: message.ExternalServices.map(externalService => ExternalServiceDefinitionMessage.toJSON(externalService))
        };
    },
    create(base?: DeepPartial<AddExternalServices>): AddExternalServices {
        return AddExternalServicesMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<AddExternalServices>): AddExternalServices {
        return {
            EventStore: object.EventStore ?? '',
            ExternalServices: object.ExternalServices?.map(externalService => ExternalServiceDefinitionMessage.fromPartial(externalService)) ?? []
        };
    }
};

/**
 * External services gRPC service definition, for use with nice-grpc's client factory.
 */
export const ExternalServicesDefinition = {
    name: 'ExternalServices',
    fullName: 'Cratis.Chronicle.Contracts.ExternalServices.ExternalServices',
    methods: {
        add: {
            name: 'Add',
            requestType: AddExternalServicesMessage,
            requestStream: false,
            responseType: EmptyMessage,
            responseStream: false,
            options: {}
        }
    }
} as const;

/**
 * External services service client interface.
 */
export interface ExternalServicesClient<CallOptionsExt = {}> {
    add(request: DeepPartial<AddExternalServices>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
}
