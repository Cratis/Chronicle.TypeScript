// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

/** An untyped callback retained by a fluent definition. */
export type ReactorCallback = (event: unknown, context: EventContext) => void | Promise<void>;
