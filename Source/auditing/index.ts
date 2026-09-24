// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export { Causation } from './Causation.js';
export { CausationType } from './CausationType.js';
export type { ICausationManager } from './ICausationManager.js';
export { CausationManager } from './CausationManager.js';

import { CausationManager } from './CausationManager.js';

/**
 * The default singleton {@link CausationManager} for the process.
 * Use this to manage the causation chain for the current async call context.
 */
export const causationManager = new CausationManager();
