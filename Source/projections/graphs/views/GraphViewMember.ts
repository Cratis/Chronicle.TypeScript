// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphViewPropertyMember } from './GraphViewPropertyMember.js';
import type { GraphViewRelationMember } from './GraphViewRelationMember.js';

/**
 * Represents a member of a view: a property of the root node, a relation to a nested view or a property of the edge
 * that was followed.
 */
export type GraphViewMember = GraphViewPropertyMember | GraphViewRelationMember;
