// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Per-client naming and privacy settings; instrumentation itself is always available. */
export interface ChronicleTelemetryOptions {
    /** Span naming convention. Defaults to legacy; both modes use the same scope and attribute families. */
    spanNames?: 'legacy' | 'convention';

    /** Absent means no event source identifiers. HMAC uses SHA-256 and a deployment-owned key. */
    eventSourceId?: { mode: 'raw' } | { mode: 'hmac'; key: Uint8Array };
}
