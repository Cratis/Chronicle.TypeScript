// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import { declareGraphViewMember } from './declareGraphViewMember.js';

/**
 * Property decorator that declares the member of a graph view that holds the key of the root node. The member reads
 * whatever property the node uses as its key, so the view does not repeat the name of it.
 * @returns A property decorator.
 */
export function viewKey(): ChroniclePropertyDecorator {
    return declareGraphViewMember({ kind: GraphViewMemberKind.Property, isKey: true });
}
