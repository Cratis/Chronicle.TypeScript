// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { GraphNodeFromModel } from './GraphNodeFromModel.js';
import type { GraphNodeRemovedWithModel } from './GraphNodeRemovedWithModel.js';

/**
 * Represents a node type with what it is projected from.
 */
export interface GraphNodeModel {
    /** The type of the node. */
    readonly type: Function;

    /** The node label. */
    readonly label: string;

    /** The name of the key property. */
    readonly keyProperty: string;

    /** The mappings that create or update nodes. */
    readonly from: readonly GraphNodeFromModel[];

    /** The mappings that delete nodes. */
    readonly removedWith: readonly GraphNodeRemovedWithModel[];
}
