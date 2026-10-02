// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Per-client naming and privacy settings; instrumentation itself is always available. */
export interface ChronicleTelemetryOptions {
    /**
     * Span naming convention. Defaults to legacy; both modes use the same scope and attribute families.
     * @deprecated Replacing the earlier "next major" plan, built-in legacy span emission ends in an upcoming
     * minor after ADR 0001's one-minor overlap. Both values will remain accepted as no-ops, without a removal deadline.
     * See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    spanNames?: 'legacy' | 'convention';

    /** Absent means no event source identifiers. HMAC uses SHA-256 and a deployment-owned key. */
    eventSourceId?: { mode: 'raw' } | { mode: 'hmac'; key: Uint8Array };
}
