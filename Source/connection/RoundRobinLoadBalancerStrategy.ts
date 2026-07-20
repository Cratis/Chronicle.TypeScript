// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleServerAddress } from './ChronicleConnectionString';
import type { ILoadBalancerStrategy } from './ILoadBalancerStrategy';

/**
 * Cycles through candidates in order, starting from a random offset chosen once per
 * strategy instance so that multiple clients don't all start at the same candidate.
 */
export class RoundRobinLoadBalancerStrategy implements ILoadBalancerStrategy {
    private _startOffset?: number;
    private _callCount = 0;

    async select(candidates: ChronicleServerAddress[]): Promise<ChronicleServerAddress> {
        if (candidates.length === 0) {
            throw new Error('Cannot select a server address from an empty candidate list');
        }

        if (this._startOffset === undefined) {
            this._startOffset = Math.floor(Math.random() * candidates.length);
        }

        const index = (this._startOffset + this._callCount) % candidates.length;
        this._callCount++;

        return candidates[index];
    }
}
