// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import type { IChronicleLogger } from './IChronicleLogger.js';
import type { ChronicleLogEntry } from './ChronicleLogEntry.js';

/** Compatibility adapter used when no application logger is supplied during the minor-release overlap. */
export class DiagChronicleLogger implements IChronicleLogger {
    log(entry: ChronicleLogEntry): void {
        diag.createComponentLogger({ namespace: entry.category })[entry.level](entry.message, entry.attributes);
    }
}
