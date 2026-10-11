// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { prepareBatchAppend } from './prepareBatchAppend.js';

/** The serialized form of a batch append, ready to be sent to the kernel. */
export type PreparedBatchAppend = ReturnType<typeof prepareBatchAppend>;
