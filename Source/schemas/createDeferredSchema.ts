// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JsonSchema } from './JsonSchema.js';
import { JsonSchemaGenerator } from './JsonSchemaGenerator.js';
import { TypeIntrospector } from '../types/TypeIntrospector.js';
import { requireCompletedStandardMetadata } from '../types/standardDecoratorMetadata.js';

/** Resolves a standard-decorated class's members and schema together, after class evaluation. */
export function createDeferredSchema(getType: () => Function): () => { members: ReadonlyMap<string, Function | undefined>; schema: JsonSchema } {
    let resolved: { members: ReadonlyMap<string, Function | undefined>; schema: JsonSchema } | undefined;
    return () => {
        const type = getType();
        requireCompletedStandardMetadata(type);
        if (!resolved) {
            const members = TypeIntrospector.getMembers(type);
            resolved = { members, schema: JsonSchemaGenerator.generate(type, members, { requireResolvedTypes: true }) };
        }
        return resolved;
    };
}
