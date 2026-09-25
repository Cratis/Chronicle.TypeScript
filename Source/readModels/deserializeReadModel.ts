// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { conceptAsTypeKey, type Constructor, Fields, Guid, JsonSerializer, typeKeyOf } from '@cratis/fundamentals';
import { TypeIntrospector } from '../types/TypeIntrospector.js';

/** Restores declared model members not covered by Fundamentals' @field-based deserializer. */
export function deserializeReadModel<TReadModel>(readModelType: Constructor<TReadModel>, json: string): TReadModel {
    if (!json) {
        return Object.create(readModelType.prototype) as TReadModel;
    }

    const instance = JsonSerializer.deserialize(readModelType as Constructor<object>, json) as TReadModel;
    const stored = JSON.parse(json) as Record<string, unknown> | null;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
        return instance;
    }

    const decoratedFields = new Set(Fields.getFieldsForType(readModelType).map(field => field.name));
    const members = TypeIntrospector.getMembers(readModelType);
    const result = instance as Record<string, unknown>;
    for (const [name, runtimeType] of members) {
        if (name.startsWith('__') || decoratedFields.has(name) || !Object.prototype.hasOwnProperty.call(stored, name)) {
            continue;
        }

        const value = stored[name];
        if (value === null || value === undefined || !runtimeType) {
            result[name] = value;
        } else if (runtimeType === Date || runtimeType === Guid || typeKeyOf(runtimeType as Constructor) === 'Guid') {
            result[name] = JsonSerializer.deserialize(runtimeType as Constructor<object>, JSON.stringify(value));
        } else if (typeKeyOf(runtimeType as Constructor) === conceptAsTypeKey) {
            result[name] = Reflect.construct(runtimeType, [value]);
        } else if (runtimeType === Number) {
            result[name] = Number(value);
        } else if (runtimeType === Boolean) {
            result[name] = Boolean(value);
        } else if (runtimeType === String) {
            result[name] = String(value);
        } else {
            result[name] = value;
        }
    }
    return instance;
}
