// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** Reports non-terminal activation, handler or effect failures. No automatic retry is performed. */
export type ReadModelReactorErrorHandler = (error: unknown, changeset: ReadModelChangeset<unknown>, reactorType: Constructor) => void | Promise<void>;
