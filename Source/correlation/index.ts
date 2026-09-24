// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export { CorrelationId } from './CorrelationId.js';
export type { ICorrelationIdAccessor } from './ICorrelationIdAccessor.js';
export type { ICorrelationIdSetter } from './ICorrelationIdSetter.js';
export { CorrelationIdManager } from './CorrelationIdManager.js';

import { CorrelationIdManager } from './CorrelationIdManager.js';

/**
 * The default singleton {@link CorrelationIdManager} for the process.
 * Use this to get and set the correlation identifier for the current async call context.
 */
export const correlationIdManager = new CorrelationIdManager();
