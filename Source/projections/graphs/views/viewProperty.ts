// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import { declareGraphViewMember } from './declareGraphViewMember.js';

/**
 * Property decorator that declares a member of a graph view that reads a property of the root node.
 * @param source - The name of the property of the node. It is matched without regard to case. When missing, the
 * name of the member is matched against the properties of the node.
 * @returns A property decorator.
 */
export function viewProperty(source?: string): ChroniclePropertyDecorator {
    return declareGraphViewMember({ kind: GraphViewMemberKind.Property, isKey: false, source });
}
