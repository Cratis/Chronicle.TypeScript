// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import type { ChronicleServerAddress } from './ChronicleConnectionString';
import { RoundRobinLoadBalancerStrategy } from './RoundRobinLoadBalancerStrategy';

describe('RoundRobinLoadBalancerStrategy', () => {
    describe('when selecting from an empty candidate list', () => {
        const strategy = new RoundRobinLoadBalancerStrategy();

        it('should throw', async () => {
            await expect(strategy.select([])).rejects.toThrow();
        });
    });

    describe('when selecting repeatedly from the same strategy instance', () => {
        const strategy = new RoundRobinLoadBalancerStrategy();
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        it('should cycle through every candidate exactly once per full cycle', async () => {
            const first = await strategy.select(candidates);
            const second = await strategy.select(candidates);
            const third = await strategy.select(candidates);
            const fourth = await strategy.select(candidates);

            const firstCycle = [first, second, third];
            expect(firstCycle).toContainEqual(candidates[0]);
            expect(firstCycle).toContainEqual(candidates[1]);
            expect(firstCycle).toContainEqual(candidates[2]);

            // The cycle wraps back to whichever candidate started it.
            expect(fourth).toEqual(first);
        });
    });

    describe('when two independent strategy instances select from the same candidates', () => {
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        it('should not always start at the same candidate', async () => {
            const startingPoints = new Set<string>();
            for (let attempt = 0; attempt < 25; attempt++) {
                const strategy = new RoundRobinLoadBalancerStrategy();
                const selected = await strategy.select(candidates);
                startingPoints.add(`${selected.host}:${selected.port}`);
            }

            // With a random starting offset across many fresh instances, at least one run
            // should land somewhere other than the first candidate.
            expect(startingPoints.size).toBeGreaterThan(1);
        });
    });
});
