// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChronicleServerAddress } from './ChronicleConnectionString';
import { LeastConnectionsLoadBalancerStrategy } from './LeastConnectionsLoadBalancerStrategy';

function textResponse(body: string, ok = true): Response {
    return { ok, text: () => Promise.resolve(body) } as Response;
}

describe('LeastConnectionsLoadBalancerStrategy', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('when selecting from an empty candidate list', () => {
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);

        it('should throw', async () => {
            await expect(strategy.select([])).rejects.toThrow();
        });
    });

    describe('when selecting from a single candidate', () => {
        const fetchMock = vi.fn();
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);
        const candidate: ChronicleServerAddress = { host: 'host1', port: 35000 };

        beforeEach(() => vi.stubGlobal('fetch', fetchMock));

        it('should return it immediately without probing', async () => {
            const selected = await strategy.select([candidate]);
            expect(selected).toEqual(candidate);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('when candidates report different connection counts', () => {
        const fetchMock = vi.fn((url: string, options?: { method?: string }) => {
            if (options?.method === 'POST') {
                return Promise.resolve(textResponse(''));
            }
            if (url.includes('host1')) {
                return Promise.resolve(textResponse('5'));
            }
            if (url.includes('host2')) {
                return Promise.resolve(textResponse('1'));
            }
            return Promise.resolve(textResponse('9'));
        });
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        beforeEach(() => vi.stubGlobal('fetch', fetchMock));

        it('should select the candidate reporting the lowest count', async () => {
            const selected = await strategy.select(candidates);
            expect(selected).toEqual({ host: 'host2', port: 35000 });
        });

        it('should probe every candidate on the /connections/count route', async () => {
            await strategy.select(candidates);
            for (const candidate of candidates) {
                expect(fetchMock).toHaveBeenCalledWith(
                    `https://${candidate.host}:${candidate.port}/connections/count`,
                    expect.anything()
                );
            }
        });

        it('should best-effort reserve a slot on the selected candidate', async () => {
            await strategy.select(candidates);
            expect(fetchMock).toHaveBeenCalledWith(
                'https://host2:35000/connections/reserve',
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('when a candidate fails to respond', () => {
        const fetchMock = vi.fn((url: string, options?: { method?: string }) => {
            if (options?.method === 'POST') {
                return Promise.resolve(textResponse(''));
            }
            if (url.includes('host1')) {
                return Promise.reject(new Error('connection refused'));
            }
            return Promise.resolve(textResponse('3'));
        });
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);
        const candidates: ChronicleServerAddress[] = [{ host: 'host1', port: 35000 }, { host: 'host2', port: 35000 }];

        beforeEach(() => vi.stubGlobal('fetch', fetchMock));

        it('should not fail the whole selection round', async () => {
            await expect(strategy.select(candidates)).resolves.toBeDefined();
        });

        it('should never select the unreachable candidate over a responder', async () => {
            const selected = await strategy.select(candidates);
            expect(selected).toEqual({ host: 'host2', port: 35000 });
        });
    });

    describe('when a candidate responds with a non-2xx status or an unparsable body', () => {
        const fetchMock = vi.fn((url: string, options?: { method?: string }) => {
            if (options?.method === 'POST') {
                return Promise.resolve(textResponse(''));
            }
            if (url.includes('host1')) {
                return Promise.resolve(textResponse('not-a-number'));
            }
            if (url.includes('host2')) {
                return Promise.resolve(textResponse('irrelevant', false));
            }
            return Promise.resolve(textResponse('7'));
        });
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        beforeEach(() => vi.stubGlobal('fetch', fetchMock));

        it('should treat both as maximally loaded and select the real responder', async () => {
            const selected = await strategy.select(candidates);
            expect(selected).toEqual({ host: 'host3', port: 35000 });
        });
    });

    describe('when every candidate reports the same count', () => {
        const fetchMock = vi.fn((_url: string, options?: { method?: string }) =>
            Promise.resolve(textResponse(options?.method === 'POST' ? '' : '2')));
        const strategy = new LeastConnectionsLoadBalancerStrategy(false, 0);
        const candidates: ChronicleServerAddress[] = [
            { host: 'host1', port: 35000 },
            { host: 'host2', port: 35000 },
            { host: 'host3', port: 35000 }
        ];

        beforeEach(() => vi.stubGlobal('fetch', fetchMock));

        it('should break the tie randomly rather than always picking the first', async () => {
            const selections = new Set<string>();
            for (let attempt = 0; attempt < 30; attempt++) {
                const selected = await strategy.select(candidates);
                selections.add(`${selected.host}:${selected.port}`);
            }
            expect(selections.size).toBeGreaterThan(1);
        });
    });
});
