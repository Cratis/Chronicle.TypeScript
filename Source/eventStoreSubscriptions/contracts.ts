// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { BinaryReader, BinaryWriter } from '@bufbuild/protobuf/wire';
import type { CallContext, CallOptions } from 'nice-grpc-common';

export interface Empty {}

export interface AddEventStoreSubscriptions {
    TargetEventStore: string;
    Subscriptions: EventStoreSubscriptionDefinitionContract[];
}

export interface EventStoreSubscriptionDefinitionContract {
    Identifier: string;
    SourceEventStore: string;
    EventTypes: EventTypeContract[];
}

export interface EventTypeContract {
    Id: string;
    Generation: number;
    Tombstone: boolean;
}

export interface RemoveEventStoreSubscriptions {
    TargetEventStore: string;
    SubscriptionIds: string[];
}

export interface GetEventStoreSubscriptions {
    TargetEventStore: string;
}

export interface IEnumerableEventStoreSubscriptionDefinitionContract {
    items: EventStoreSubscriptionDefinitionContract[];
}

function createBaseEmpty(): Empty {
    return {};
}

function createBaseAddEventStoreSubscriptions(): AddEventStoreSubscriptions {
    return { TargetEventStore: '', Subscriptions: [] };
}

function createBaseEventStoreSubscriptionDefinition(): EventStoreSubscriptionDefinitionContract {
    return { Identifier: '', SourceEventStore: '', EventTypes: [] };
}

function createBaseEventType(): EventTypeContract {
    return { Id: '', Generation: 0, Tombstone: false };
}

function createBaseRemoveEventStoreSubscriptions(): RemoveEventStoreSubscriptions {
    return { TargetEventStore: '', SubscriptionIds: [] };
}

function createBaseGetEventStoreSubscriptions(): GetEventStoreSubscriptions {
    return { TargetEventStore: '' };
}

function createBaseIEnumerableEventStoreSubscriptionDefinition(): IEnumerableEventStoreSubscriptionDefinitionContract {
    return { items: [] };
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
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return createBaseEmpty();
    },
    fromJSON(_: unknown): Empty {
        return createBaseEmpty();
    },
    toJSON(_: Empty): unknown {
        return {};
    },
    create(base?: DeepPartial<Empty>): Empty {
        return EmptyMessage.fromPartial(base ?? {});
    },
    fromPartial(_: DeepPartial<Empty>): Empty {
        return createBaseEmpty();
    }
};

export const AddEventStoreSubscriptionsMessage: MessageFns<AddEventStoreSubscriptions> = {
    encode(message: AddEventStoreSubscriptions, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.TargetEventStore !== '') {
            writer.uint32(10).string(message.TargetEventStore);
        }
        for (const subscription of message.Subscriptions) {
            EventStoreSubscriptionDefinitionMessage.encode(subscription, writer.uint32(18).fork()).join();
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): AddEventStoreSubscriptions {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseAddEventStoreSubscriptions();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.TargetEventStore = reader.string();
                    continue;
                case 2:
                    message.Subscriptions.push(EventStoreSubscriptionDefinitionMessage.decode(reader, reader.uint32()));
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): AddEventStoreSubscriptions {
        const value = object as { TargetEventStore?: unknown; Subscriptions?: unknown[] };
        return {
            TargetEventStore: typeof value.TargetEventStore === 'string' ? value.TargetEventStore : '',
            Subscriptions: Array.isArray(value.Subscriptions)
                ? value.Subscriptions.map(_ => EventStoreSubscriptionDefinitionMessage.fromJSON(_))
                : []
        };
    },
    toJSON(message: AddEventStoreSubscriptions): unknown {
        return {
            TargetEventStore: message.TargetEventStore,
            Subscriptions: message.Subscriptions.map(_ => EventStoreSubscriptionDefinitionMessage.toJSON(_))
        };
    },
    create(base?: DeepPartial<AddEventStoreSubscriptions>): AddEventStoreSubscriptions {
        return AddEventStoreSubscriptionsMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<AddEventStoreSubscriptions>): AddEventStoreSubscriptions {
        return {
            TargetEventStore: object.TargetEventStore ?? '',
            Subscriptions: object.Subscriptions?.map(_ => EventStoreSubscriptionDefinitionMessage.fromPartial(_)) ?? []
        };
    }
};

export const EventStoreSubscriptionDefinitionMessage: MessageFns<EventStoreSubscriptionDefinitionContract> = {
    encode(message: EventStoreSubscriptionDefinitionContract, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Identifier !== '') {
            writer.uint32(10).string(message.Identifier);
        }
        if (message.SourceEventStore !== '') {
            writer.uint32(18).string(message.SourceEventStore);
        }
        for (const eventType of message.EventTypes) {
            EventTypeMessage.encode(eventType, writer.uint32(26).fork()).join();
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): EventStoreSubscriptionDefinitionContract {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseEventStoreSubscriptionDefinition();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.Identifier = reader.string();
                    continue;
                case 2:
                    message.SourceEventStore = reader.string();
                    continue;
                case 3:
                    message.EventTypes.push(EventTypeMessage.decode(reader, reader.uint32()));
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): EventStoreSubscriptionDefinitionContract {
        const value = object as { Identifier?: unknown; SourceEventStore?: unknown; EventTypes?: unknown[] };
        return {
            Identifier: typeof value.Identifier === 'string' ? value.Identifier : '',
            SourceEventStore: typeof value.SourceEventStore === 'string' ? value.SourceEventStore : '',
            EventTypes: Array.isArray(value.EventTypes)
                ? value.EventTypes.map(_ => EventTypeMessage.fromJSON(_))
                : []
        };
    },
    toJSON(message: EventStoreSubscriptionDefinitionContract): unknown {
        return {
            Identifier: message.Identifier,
            SourceEventStore: message.SourceEventStore,
            EventTypes: message.EventTypes.map(_ => EventTypeMessage.toJSON(_))
        };
    },
    create(base?: DeepPartial<EventStoreSubscriptionDefinitionContract>): EventStoreSubscriptionDefinitionContract {
        return EventStoreSubscriptionDefinitionMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<EventStoreSubscriptionDefinitionContract>): EventStoreSubscriptionDefinitionContract {
        return {
            Identifier: object.Identifier ?? '',
            SourceEventStore: object.SourceEventStore ?? '',
            EventTypes: object.EventTypes?.map(_ => EventTypeMessage.fromPartial(_)) ?? []
        };
    }
};

export const EventTypeMessage: MessageFns<EventTypeContract> = {
    encode(message: EventTypeContract, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.Id !== '') {
            writer.uint32(10).string(message.Id);
        }
        if (message.Generation !== 0) {
            writer.uint32(16).uint32(message.Generation);
        }
        if (message.Tombstone !== false) {
            writer.uint32(24).bool(message.Tombstone);
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): EventTypeContract {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseEventType();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.Id = reader.string();
                    continue;
                case 2:
                    message.Generation = reader.uint32();
                    continue;
                case 3:
                    message.Tombstone = reader.bool();
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): EventTypeContract {
        const value = object as { Id?: unknown; Generation?: unknown; Tombstone?: unknown };
        return {
            Id: typeof value.Id === 'string' ? value.Id : '',
            Generation: typeof value.Generation === 'number' ? value.Generation : 0,
            Tombstone: typeof value.Tombstone === 'boolean' ? value.Tombstone : false
        };
    },
    toJSON(message: EventTypeContract): unknown {
        return {
            Id: message.Id,
            Generation: message.Generation,
            Tombstone: message.Tombstone
        };
    },
    create(base?: DeepPartial<EventTypeContract>): EventTypeContract {
        return EventTypeMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<EventTypeContract>): EventTypeContract {
        return {
            Id: object.Id ?? '',
            Generation: object.Generation ?? 0,
            Tombstone: object.Tombstone ?? false
        };
    }
};

export const RemoveEventStoreSubscriptionsMessage: MessageFns<RemoveEventStoreSubscriptions> = {
    encode(message: RemoveEventStoreSubscriptions, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.TargetEventStore !== '') {
            writer.uint32(10).string(message.TargetEventStore);
        }
        for (const subscriptionId of message.SubscriptionIds) {
            writer.uint32(18).string(subscriptionId);
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): RemoveEventStoreSubscriptions {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseRemoveEventStoreSubscriptions();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.TargetEventStore = reader.string();
                    continue;
                case 2:
                    message.SubscriptionIds.push(reader.string());
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): RemoveEventStoreSubscriptions {
        const value = object as { TargetEventStore?: unknown; SubscriptionIds?: unknown[] };
        return {
            TargetEventStore: typeof value.TargetEventStore === 'string' ? value.TargetEventStore : '',
            SubscriptionIds: Array.isArray(value.SubscriptionIds)
                ? value.SubscriptionIds.map(_ => String(_))
                : []
        };
    },
    toJSON(message: RemoveEventStoreSubscriptions): unknown {
        return {
            TargetEventStore: message.TargetEventStore,
            SubscriptionIds: message.SubscriptionIds
        };
    },
    create(base?: DeepPartial<RemoveEventStoreSubscriptions>): RemoveEventStoreSubscriptions {
        return RemoveEventStoreSubscriptionsMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<RemoveEventStoreSubscriptions>): RemoveEventStoreSubscriptions {
        return {
            TargetEventStore: object.TargetEventStore ?? '',
            SubscriptionIds: object.SubscriptionIds?.map(_ => _) ?? []
        };
    }
};

export const GetEventStoreSubscriptionsMessage: MessageFns<GetEventStoreSubscriptions> = {
    encode(message: GetEventStoreSubscriptions, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        if (message.TargetEventStore !== '') {
            writer.uint32(10).string(message.TargetEventStore);
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): GetEventStoreSubscriptions {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseGetEventStoreSubscriptions();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.TargetEventStore = reader.string();
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): GetEventStoreSubscriptions {
        const value = object as { TargetEventStore?: unknown };
        return {
            TargetEventStore: typeof value.TargetEventStore === 'string' ? value.TargetEventStore : ''
        };
    },
    toJSON(message: GetEventStoreSubscriptions): unknown {
        return {
            TargetEventStore: message.TargetEventStore
        };
    },
    create(base?: DeepPartial<GetEventStoreSubscriptions>): GetEventStoreSubscriptions {
        return GetEventStoreSubscriptionsMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<GetEventStoreSubscriptions>): GetEventStoreSubscriptions {
        return {
            TargetEventStore: object.TargetEventStore ?? ''
        };
    }
};

export const IEnumerableEventStoreSubscriptionDefinitionMessage: MessageFns<IEnumerableEventStoreSubscriptionDefinitionContract> = {
    encode(message: IEnumerableEventStoreSubscriptionDefinitionContract, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
        for (const item of message.items) {
            EventStoreSubscriptionDefinitionMessage.encode(item, writer.uint32(10).fork()).join();
        }
        return writer;
    },
    decode(input: BinaryReader | Uint8Array, length?: number): IEnumerableEventStoreSubscriptionDefinitionContract {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = createBaseIEnumerableEventStoreSubscriptionDefinition();
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1:
                    message.items.push(EventStoreSubscriptionDefinitionMessage.decode(reader, reader.uint32()));
                    continue;
            }
            if ((tag & 7) === 4 || tag === 0) {
                break;
            }
            reader.skip(tag & 7);
        }
        return message;
    },
    fromJSON(object: unknown): IEnumerableEventStoreSubscriptionDefinitionContract {
        const value = object as { items?: unknown[] };
        return {
            items: Array.isArray(value.items)
                ? value.items.map(_ => EventStoreSubscriptionDefinitionMessage.fromJSON(_))
                : []
        };
    },
    toJSON(message: IEnumerableEventStoreSubscriptionDefinitionContract): unknown {
        return {
            items: message.items.map(_ => EventStoreSubscriptionDefinitionMessage.toJSON(_))
        };
    },
    create(base?: DeepPartial<IEnumerableEventStoreSubscriptionDefinitionContract>): IEnumerableEventStoreSubscriptionDefinitionContract {
        return IEnumerableEventStoreSubscriptionDefinitionMessage.fromPartial(base ?? {});
    },
    fromPartial(object: DeepPartial<IEnumerableEventStoreSubscriptionDefinitionContract>): IEnumerableEventStoreSubscriptionDefinitionContract {
        return {
            items: object.items?.map(_ => EventStoreSubscriptionDefinitionMessage.fromPartial(_)) ?? []
        };
    }
};

export const EventStoreSubscriptionsDefinition = {
    name: 'EventStoreSubscriptions',
    fullName: 'Cratis.Chronicle.Contracts.Observation.EventStoreSubscriptions.EventStoreSubscriptions',
    methods: {
        add: {
            name: 'Add',
            requestType: AddEventStoreSubscriptionsMessage,
            requestStream: false,
            responseType: EmptyMessage,
            responseStream: false,
            options: {}
        },
        getSubscriptions: {
            name: 'GetSubscriptions',
            requestType: GetEventStoreSubscriptionsMessage,
            requestStream: false,
            responseType: IEnumerableEventStoreSubscriptionDefinitionMessage,
            responseStream: false,
            options: {}
        },
        remove: {
            name: 'Remove',
            requestType: RemoveEventStoreSubscriptionsMessage,
            requestStream: false,
            responseType: EmptyMessage,
            responseStream: false,
            options: {}
        }
    }
} as const;

export interface EventStoreSubscriptionsClient<CallOptionsExt = {}> {
    add(request: DeepPartial<AddEventStoreSubscriptions>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
    getSubscriptions(
        request: DeepPartial<GetEventStoreSubscriptions>,
        options?: CallOptions & CallOptionsExt
    ): Promise<IEnumerableEventStoreSubscriptionDefinitionContract>;
    remove(request: DeepPartial<RemoveEventStoreSubscriptions>, options?: CallOptions & CallOptionsExt): Promise<Empty>;
}

export interface EventStoreSubscriptionsServiceImplementation<CallContextExt = {}> {
    add(request: AddEventStoreSubscriptions, context: CallContext & CallContextExt): Promise<DeepPartial<Empty>>;
    getSubscriptions(
        request: GetEventStoreSubscriptions,
        context: CallContext & CallContextExt
    ): Promise<DeepPartial<IEnumerableEventStoreSubscriptionDefinitionContract>>;
    remove(request: RemoveEventStoreSubscriptions, context: CallContext & CallContextExt): Promise<DeepPartial<Empty>>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | bigint | undefined;
type DeepPartial<T> = T extends Builtin ? T
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
