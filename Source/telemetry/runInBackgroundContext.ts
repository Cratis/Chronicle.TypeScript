// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { context, ROOT_CONTEXT } from '@opentelemetry/api';
import { correlationIdManager } from '../correlation/index.js';

/** Starts client-owned work without retaining the initiating request's trace or business correlation. */
export function runInBackgroundContext<T>(action: () => T): T {
    return context.with(ROOT_CONTEXT, () => correlationIdManager.runWithout(action));
}
