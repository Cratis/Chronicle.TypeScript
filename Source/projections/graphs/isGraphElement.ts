// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { getEdgeMetadata } from './edge.js';
import { getNodeMetadata } from './node.js';

/**
 * Gets whether a type is a node or an edge of a property graph.
 * @param type - The type to check.
 * @returns True if it is a node or an edge, false if not.
 */
export function isGraphElement(type: Function): boolean {
    return getNodeMetadata(type) !== undefined || getEdgeMetadata(type) !== undefined;
}
