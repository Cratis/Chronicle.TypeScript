// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import { declareGraphViewMember } from './declareGraphViewMember.js';

/**
 * Property decorator that declares a member of a graph view that reads a property of the edge that was followed to
 * reach the view. It is valid only in a view that is the target of relations of exactly one edge type.
 * @param source - The name of the property of the edge. It is matched without regard to case. When missing, the
 * name of the member is matched against the properties of the edge.
 * @returns A property decorator.
 */
export function fromEdge(source?: string): ChroniclePropertyDecorator {
    return declareGraphViewMember({ kind: GraphViewMemberKind.EdgeProperty, isKey: false, source });
}
