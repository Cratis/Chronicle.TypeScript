// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleLogEntry } from './ChronicleLogEntry.js';

/** Application-owned diagnostic sink, configured separately for each Chronicle client. */
export interface IChronicleLogger {
    /** Receives one sanitized diagnostic. Implementations should not throw. */
    log(entry: ChronicleLogEntry): void;
}
