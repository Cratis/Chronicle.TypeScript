// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendOptions } from './AppendOptions.js';

/**
 * Options for appending a compensating event.
 * The event source, event stream and subject always come from the event being compensated, so routing options are not available.
 */
export type CompensateOptions = Pick<AppendOptions, 'correlationId' | 'tags' | 'occurred'>;
