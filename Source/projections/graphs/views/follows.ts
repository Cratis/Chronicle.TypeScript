// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChroniclePropertyDecorator } from '../../../types/propertyDecoratorMetadata.js';
import type { FollowsOptions } from './FollowsOptions.js';
import { GraphViewCardinality } from './GraphViewCardinality.js';
import type { GraphViewEdgeReference } from './GraphViewEdgeReference.js';
import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import { declareGraphViewMember } from './declareGraphViewMember.js';

/**
 * Property decorator that declares a member of a graph view that follows one edge type to a nested view.
 * @param edge - The edge to follow: a function returning the edge class, or the edge type string.
 * @param view - A function returning the class of the nested view.
 * @param options - The cardinality, which is many by default, and the direction, which is derived unless the edge
 * starts and ends at the same label.
 * @returns A property decorator.
 */
export function follows(edge: GraphViewEdgeReference, view: () => Function, options: FollowsOptions = {}): ChroniclePropertyDecorator {
    return declareGraphViewMember({
        kind: GraphViewMemberKind.Relation,
        isKey: false,
        edge,
        view,
        direction: options.direction,
        cardinality: options.cardinality ?? GraphViewCardinality.Many
    });
}
