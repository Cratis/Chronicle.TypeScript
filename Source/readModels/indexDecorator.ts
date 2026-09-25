// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { conceptAsTypeKey, type Constructor, Fields, typeKeyOf } from '@cratis/fundamentals';
import type { IndexDefinition } from '@cratis/chronicle.contracts';
import { getChildrenFromMetadata } from '../projections/modelBound/childrenFrom.js';
import { TypeIntrospector } from '../types/TypeIntrospector.js';
import { ChroniclePropertyDecorator, decorateProperty, hasPropertyMetadata } from '../types/propertyDecoratorMetadata.js';

const INDEX_METADATA_KEY = 'chronicle:readModel:index';

/**
 * Marks a read-model property for a single ascending, non-unique index.
 * Indexed fields on nested objects or typed collections use dotted property paths.
 * @returns A property decorator.
 */
export function index(): ChroniclePropertyDecorator {
    return decorateProperty((target: object, propertyKey: string | symbol) => {
        const name = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, name);
        Reflect.defineMetadata(INDEX_METADATA_KEY, true, target, name);
    });
}

/** Collects the indexed paths of a read model, including nested objects and typed collections. */
export function getIndexesForType(type: Function): IndexDefinition[] {
    const indexes: IndexDefinition[] = [];
    const visited = new Set<Function>();

    function collect(current: Function, prefix: string): void {
        if (visited.has(current)) return;
        visited.add(current);

        const fields = Fields.getFieldsForType(current as Constructor);
        for (const [name, memberType] of TypeIntrospector.getMembers(current)) {
            const path = prefix ? `${prefix}.${name}` : name;
            if (hasPropertyMetadata(INDEX_METADATA_KEY, current.prototype, name)) {
                indexes.push({ PropertyPath: path });
            }

            const nestedType = memberType === Array
                ? getChildrenFromMetadata(current.prototype, name).find(entry => entry.childType)?.childType
                    ?? fields.find(field => field.name === name)?.genericArguments?.[0]
                : memberType;
            const isComplex = nestedType && nestedType !== String && nestedType !== Number && nestedType !== Boolean &&
                nestedType !== Date && nestedType !== Array && nestedType !== Object;
            if (isComplex && typeKeyOf(nestedType as Constructor) !== conceptAsTypeKey &&
                typeKeyOf(nestedType as Constructor) !== 'Guid') {
                collect(nestedType, path);
            }
        }
    }

    collect(type, '');
    return indexes;
}
