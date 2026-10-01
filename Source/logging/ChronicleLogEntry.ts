// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Attributes } from '@opentelemetry/api';
import type { ChronicleLogLevel } from './ChronicleLogLevel.js';

/** Structured diagnostic without event payloads, error messages or error stacks. */
export interface ChronicleLogEntry {
    readonly category: string;
    readonly level: ChronicleLogLevel;
    readonly message: string;
    /** Safe diagnostic fields, including correlation and valid trace/span identifiers when available. */
    readonly attributes: Readonly<Attributes>;
}
