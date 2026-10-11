// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { prepareSingleAppend } from './prepareSingleAppend.js';

/** The serialized form of a single append, ready to be sent to the kernel. */
export type PreparedSingleAppend = ReturnType<typeof prepareSingleAppend>;
