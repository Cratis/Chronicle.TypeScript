// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Per-client privacy and compatibility settings; instrumentation itself is always available. */
export interface ChronicleTelemetryOptions {
    /**
     * Retained naming selector. Both 'legacy' and 'convention' are accepted as no-ops;
     * built-in instrumentation always uses conventionSpans, including when this option is absent.
     * @deprecated No longer selects names. This option has no removal deadline.
     * The minor-release naming cutoff replaces the earlier "next major" plan after ADR 0001's one-minor overlap.
     * See https://github.com/Cratis/Chronicle.TypeScript/issues/171.
     */
    spanNames?: 'legacy' | 'convention';

    /** Absent means no event source identifiers. HMAC uses SHA-256 and a deployment-owned key. */
    eventSourceId?: { mode: 'raw' } | { mode: 'hmac'; key: Uint8Array };
}
