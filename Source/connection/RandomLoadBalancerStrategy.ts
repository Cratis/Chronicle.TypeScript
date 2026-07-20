// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleServerAddress } from './ChronicleConnectionString';
import type { ILoadBalancerStrategy } from './ILoadBalancerStrategy';

/**
 * Selects a uniformly random candidate on every call.
 */
export class RandomLoadBalancerStrategy implements ILoadBalancerStrategy {
    async select(candidates: ChronicleServerAddress[]): Promise<ChronicleServerAddress> {
        if (candidates.length === 0) {
            throw new Error('Cannot select a server address from an empty candidate list');
        }

        const index = Math.floor(Math.random() * candidates.length);
        return candidates[index];
    }
}
