// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export { Causation } from './Causation';
export { CausationType } from './CausationType';
export type { ICausationManager } from './ICausationManager';
export { CausationManager } from './CausationManager';

import { CausationManager } from './CausationManager';

/**
 * The default singleton {@link CausationManager} for the process.
 * Use this to manage the causation chain for the current async call context.
 */
export const causationManager = new CausationManager();
