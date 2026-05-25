// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export { CorrelationId } from './CorrelationId';
export type { ICorrelationIdAccessor } from './ICorrelationIdAccessor';
export type { ICorrelationIdSetter } from './ICorrelationIdSetter';
export { CorrelationIdManager } from './CorrelationIdManager';

import { CorrelationIdManager } from './CorrelationIdManager';

/**
 * The default singleton {@link CorrelationIdManager} for the process.
 * Use this to get and set the correlation identifier for the current async call context.
 */
export const correlationIdManager = new CorrelationIdManager();
