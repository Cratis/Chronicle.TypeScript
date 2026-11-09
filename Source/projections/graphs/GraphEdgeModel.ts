// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphEdgeFromModel } from './GraphEdgeFromModel.js';
import type { GraphEdgeRemovedWithModel } from './GraphEdgeRemovedWithModel.js';

/**
 * Represents an edge type with what it is projected from.
 */
export interface GraphEdgeModel {
    /** The type of the edge. */
    readonly type: Function;

    /** The edge type name, for example MEMBER_OF. */
    readonly edgeType: string;

    /** The type of the node the edge starts at. */
    readonly sourceNode: Function;

    /** The type of the node the edge ends at. */
    readonly targetNode: Function;

    /** The name of the identifying property, if any. */
    readonly identifyingProperty?: string;

    /** The names of the members that are not properties of the edge: the ones holding the keys of the end nodes. */
    readonly excludedProperties: readonly string[];

    /** The mappings that create or update edges. */
    readonly from: readonly GraphEdgeFromModel[];

    /** The mappings that delete edges. */
    readonly removedWith: readonly GraphEdgeRemovedWithModel[];
}
