// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ChronicleServerAddress } from './ChronicleConnectionString';

/**
 * Selects one server address from a list of candidates for a connect/reconnect attempt.
 */
export interface ILoadBalancerStrategy {
    /**
     * Selects one address from the given candidates.
     * @param candidates - The addresses to select from. Never empty.
     * @returns A promise resolving to the selected address.
     */
    select(candidates: ChronicleServerAddress[]): Promise<ChronicleServerAddress>;
}
