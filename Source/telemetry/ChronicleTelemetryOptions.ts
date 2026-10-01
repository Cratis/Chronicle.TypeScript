// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Per-client privacy settings; instrumentation itself is always available. */
export interface ChronicleTelemetryOptions {
    /** Absent means no event source identifiers. HMAC uses SHA-256 and a deployment-owned key. */
    eventSourceId?: { mode: 'raw' } | { mode: 'hmac'; key: Uint8Array };
}
