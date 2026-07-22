// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Agent } from 'undici';
import type { ChronicleServerAddress } from './ChronicleConnectionString';
import { formatServerAddress } from './formatServerAddress';
import type { ILoadBalancerStrategy } from './ILoadBalancerStrategy';

const DEFAULT_MAX_JITTER_MS = 250;
const PROBE_TIMEOUT_MS = 2000;

// Node's global fetch types its `dispatcher` option against `undici-types` (bundled with
// @types/node), which is structurally close to but not identical to the real `undici`
// package's own `Agent`/`Dispatcher` types - hence the assertion through `unknown` at every
// use below.
type FetchDispatcher = NonNullable<RequestInit['dispatcher']>;

/**
 * Selects the least-loaded candidate by probing each one's current connection count over
 * HTTP and picking the minimum, breaking ties randomly. This is the default strategy.
 *
 * Before every probe attempt (not just the first), waits a random jitter to avoid a
 * thundering herd of clients probing every candidate at the exact same instant. A single
 * candidate is returned immediately without probing, since there is nothing to choose
 * between.
 */
export class LeastConnectionsLoadBalancerStrategy implements ILoadBalancerStrategy {
    private readonly _dispatcher: Agent;

    /**
     * Initializes a new instance of {@link LeastConnectionsLoadBalancerStrategy}.
     * @param skipTlsValidation - Whether to skip TLS certificate validation on the
     * `/connections/count` and `/connections/reserve` probe requests, matching the toggle
     * used for the gRPC channel itself.
     * @param maxJitterMs - The maximum jitter, in milliseconds, to wait before every probe
     * attempt. Defaults to 250ms. 0 disables jitter entirely.
     */
    constructor(
        private readonly _skipTlsValidation: boolean,
        private readonly _maxJitterMs: number = DEFAULT_MAX_JITTER_MS
    ) {
        this._dispatcher = new Agent({ connect: { rejectUnauthorized: !this._skipTlsValidation } });
    }

    async select(candidates: ChronicleServerAddress[]): Promise<ChronicleServerAddress> {
        if (candidates.length === 0) {
            throw new Error('Cannot select a server address from an empty candidate list');
        }

        if (candidates.length === 1) {
            return candidates[0];
        }

        await this.jitter();

        const connectionCounts = await Promise.all(candidates.map(candidate => this.probeConnectionCount(candidate)));
        const minimumCount = Math.min(...connectionCounts);
        const minimumIndices = connectionCounts.reduce<number[]>((indices, count, index) => {
            if (count === minimumCount) {
                indices.push(index);
            }
            return indices;
        }, []);

        const selected = candidates[minimumIndices[Math.floor(Math.random() * minimumIndices.length)]];

        await this.reserve(selected);

        return selected;
    }

    private async jitter(): Promise<void> {
        if (this._maxJitterMs <= 0) {
            return;
        }

        const delayMs = Math.floor(Math.random() * this._maxJitterMs);
        if (delayMs <= 0) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    private async probeConnectionCount(candidate: ChronicleServerAddress): Promise<number> {
        try {
            const response = await fetch(`https://${formatServerAddress(candidate)}/connections/count`, {
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
                dispatcher: this._dispatcher as unknown as FetchDispatcher
            });

            if (!response.ok) {
                return Number.MAX_SAFE_INTEGER;
            }

            const body = (await response.text()).trim();
            const count = Number(body);
            return body.length > 0 && Number.isFinite(count) ? count : Number.MAX_SAFE_INTEGER;
        } catch {
            // A candidate that cannot be reached or answers with garbage is never preferred
            // over one that responds normally, but must not fail the whole selection round.
            return Number.MAX_SAFE_INTEGER;
        }
    }

    private async reserve(candidate: ChronicleServerAddress): Promise<void> {
        try {
            await fetch(`https://${formatServerAddress(candidate)}/connections/reserve`, {
                method: 'POST',
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
                dispatcher: this._dispatcher as unknown as FetchDispatcher
            });
        } catch {
            // Best-effort reservation; the selected server is still used even if this fails.
        }
    }
}
