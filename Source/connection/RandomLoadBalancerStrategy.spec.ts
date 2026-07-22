// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import type { ChronicleServerAddress } from './ChronicleConnectionString';
import { RandomLoadBalancerStrategy } from './RandomLoadBalancerStrategy';

describe('RandomLoadBalancerStrategy', () => {
    describe('when selecting from an empty candidate list', () => {
        const strategy = new RandomLoadBalancerStrategy();

        it('should throw', async () => {
            await expect(strategy.select([])).rejects.toThrow();
        });
    });

    describe('when selecting from a single candidate', () => {
        const strategy = new RandomLoadBalancerStrategy();
        const candidate: ChronicleServerAddress = { host: 'host1', port: 35000 };

        it('should return that candidate', async () => {
            expect(await strategy.select([candidate])).toEqual(candidate);
        });
    });

    describe('when selecting from many candidates repeatedly', () => {
        const strategy = new RandomLoadBalancerStrategy();
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        it('should always return one of the candidates', async () => {
            for (let attempt = 0; attempt < 25; attempt++) {
                const selected = await strategy.select(candidates);
                expect(candidates).toContainEqual(selected);
            }
        });

        it('should eventually select more than one distinct candidate', async () => {
            const selections = new Set<string>();
            for (let attempt = 0; attempt < 50; attempt++) {
                const selected = await strategy.select(candidates);
                selections.add(`${selected.host}:${selected.port}`);
            }
            expect(selections.size).toBeGreaterThan(1);
        });
    });
});
