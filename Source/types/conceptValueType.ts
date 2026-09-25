// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

/** Resolves the runtime value type erased from ConceptAs<T>. */
export function conceptValueType(type: Function): Function | undefined {
    return (type as Function & { valueType?: Function }).valueType ??
        Reflect.getMetadata('design:type', type.prototype, 'value') as Function | undefined ??
        (Reflect.getMetadata('design:paramtypes', type) as Function[] | undefined)?.[0];
}
