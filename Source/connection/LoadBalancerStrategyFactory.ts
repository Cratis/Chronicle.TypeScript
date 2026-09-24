// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ILoadBalancerStrategy } from './ILoadBalancerStrategy.js';
import { LeastConnectionsLoadBalancerStrategy } from './LeastConnectionsLoadBalancerStrategy.js';
import { LoadBalancerMode } from './LoadBalancerMode.js';
import { RandomLoadBalancerStrategy } from './RandomLoadBalancerStrategy.js';
import { RoundRobinLoadBalancerStrategy } from './RoundRobinLoadBalancerStrategy.js';

/**
 * Creates the {@link ILoadBalancerStrategy} instance matching a {@link LoadBalancerMode}.
 * @param mode - The load balancer mode to create a strategy for.
 * @param skipTlsValidation - Whether to skip TLS certificate validation for strategies that
 * probe candidates over HTTP (currently only {@link LoadBalancerMode.LeastConnections}).
 * @returns The load balancer strategy instance.
 */
export function createLoadBalancerStrategy(mode: LoadBalancerMode, skipTlsValidation: boolean): ILoadBalancerStrategy {
    switch (mode) {
        case LoadBalancerMode.RoundRobin:
            return new RoundRobinLoadBalancerStrategy();
        case LoadBalancerMode.Random:
            return new RandomLoadBalancerStrategy();
        case LoadBalancerMode.LeastConnections:
            return new LeastConnectionsLoadBalancerStrategy(skipTlsValidation);
        default:
            throw new Error(`Unknown load balancer mode: ${mode}`);
    }
}
