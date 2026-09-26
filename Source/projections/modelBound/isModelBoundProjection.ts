// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { hasModelBoundProperties } from '../../types/TypeDiscoverer.js';
import { hasFromEventMetadata } from './fromEvent.js';

/** Returns whether a read model declares model-bound projection metadata. */
export function isModelBoundProjection(type: Function): boolean {
    return hasFromEventMetadata(type) || hasModelBoundProperties(type);
}
