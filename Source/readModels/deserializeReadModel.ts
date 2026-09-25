// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { conceptAsTypeKey, type Constructor, Fields, Guid, JsonSerializer, typeKeyOf } from '@cratis/fundamentals';
import { TypeIntrospector } from '../types/TypeIntrospector.js';
import { conceptValueType } from '../types/conceptValueType.js';

const memberCache = new WeakMap<Function, Map<string, Function | undefined>>();

function membersFor(type: Function): Map<string, Function | undefined> {
    let members = memberCache.get(type);
    if (!members) {
        members = TypeIntrospector.getMembers(type);
        memberCache.set(type, members);
    }
    return members;
}

function writable(type: Function, name: string): boolean {
    let prototype = type.prototype;
    while (prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (descriptor) return !descriptor.get || !!descriptor.set;
        prototype = Object.getPrototypeOf(prototype);
    }
    return true;
}

function convert(type: Function, value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeKeyOf(type as Constructor) === conceptAsTypeKey) {
        const underlying = conceptValueType(type);
        return Reflect.construct(type, [underlying ? convert(underlying, value) : value]);
    }
    if (type === Boolean) return typeof value === 'string' && /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : value;
    if (type === Number) return Number(value);
    if (type === String) return String(value);
    if (type === Date || type === Guid || typeKeyOf(type as Constructor) === 'Guid') {
        return JsonSerializer.deserializeFromInstance(type as Constructor<object>, value);
    }
    if (typeof value === 'object' && type !== Array && type !== Object && !Array.isArray(value)) {
        return restore(type as Constructor<object>, value as Record<string, unknown>);
    }
    return value;
}

function restore<T>(type: Constructor<T>, stored: Record<string, unknown> | null): T {
    const fields = Fields.getFieldsForType(type);
    const instance = fields.length > 0
        ? JsonSerializer.deserializeFromInstance(type as Constructor<object>, stored) as T
        : Reflect.construct(type, []) as T;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return instance;

    const fieldByName = new Map(fields.map(field => [field.name, field]));
    const result = instance as Record<string, unknown>;
    for (const [name, runtimeType] of membersFor(type)) {
        if (name.startsWith('__') || !writable(type, name) || !Object.prototype.hasOwnProperty.call(stored, name)) continue;
        const value = stored[name];
        const field = fieldByName.get(name);
        const childType = field?.genericArguments?.[0];
        if (Array.isArray(value) && childType) {
            result[name] = value.map(item => convert(childType, item));
        } else if (field && (value === null || value === undefined || !runtimeType || runtimeType === Array || runtimeType === Object || typeof value !== 'object')) {
            // The serializer has already handled decorated scalar fields.
            if (value === null || value === undefined) result[name] = value;
        } else {
            result[name] = value === null || value === undefined || !runtimeType ? value : convert(runtimeType, value);
        }
    }
    return instance;
}

/** Restores declared model members not covered by Fundamentals' @field-based deserializer. */
export function deserializeReadModel<TReadModel>(readModelType: Constructor<TReadModel>, json: string): TReadModel {
    if (!json) {
        return Object.create(readModelType.prototype) as TReadModel;
    }

    return restore(readModelType, JSON.parse(json) as Record<string, unknown> | null);
}
