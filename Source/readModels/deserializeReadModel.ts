// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { conceptAsTypeKey, type Constructor, Fields, Guid, JsonSerializer, typeKeyOf } from '@cratis/fundamentals';
import { TypeIntrospector } from '../types/TypeIntrospector.js';

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
        const underlying = (Reflect.getMetadata('design:paramtypes', type) as Function[] | undefined)?.[0];
        return Reflect.construct(type, [underlying ? convert(underlying, value) : value]);
    }
    if (type === Boolean) return typeof value === 'string' && /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : value;
    if (type === Number) return Number(value);
    if (type === String) return String(value);
    if (type === Date || type === Guid || typeKeyOf(type as Constructor) === 'Guid' ||
        (typeof value === 'object' && type !== Array && type !== Object)) {
        return JsonSerializer.deserializeFromInstance(type as Constructor<object>, value);
    }
    return value;
}

/** Restores declared model members not covered by Fundamentals' @field-based deserializer. */
export function deserializeReadModel<TReadModel>(readModelType: Constructor<TReadModel>, json: string): TReadModel {
    if (!json) {
        return Object.create(readModelType.prototype) as TReadModel;
    }

    const stored = JSON.parse(json) as Record<string, unknown> | null;
    const instance = JsonSerializer.deserializeFromInstance(readModelType as Constructor<object>, stored) as TReadModel;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
        return instance;
    }

    const decoratedFields = new Set(Fields.getFieldsForType(readModelType).map(field => field.name));
    const members = membersFor(readModelType);
    const result = instance as Record<string, unknown>;
    for (const [name, runtimeType] of members) {
        if (name.startsWith('__') || decoratedFields.has(name) || !writable(readModelType, name) || !Object.prototype.hasOwnProperty.call(stored, name)) {
            continue;
        }

        const value = stored[name];
        if (value === null || value === undefined || !runtimeType) {
            result[name] = value;
        } else {
            result[name] = convert(runtimeType, value);
        }
    }
    return instance;
}
