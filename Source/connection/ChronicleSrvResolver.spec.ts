// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SrvRecord } from 'dns';
import { describe, expect, it, vi } from 'vitest';
import { ChronicleSrvResolutionError } from './ChronicleSrvResolutionError';
import { ChronicleSrvResolver } from './ChronicleSrvResolver';

function createFakeResolver(records: SrvRecord[]) {
    const setServers = vi.fn();
    const resolveSrv = vi.fn().mockResolvedValue(records);
    return { setServers, resolveSrv };
}

describe('ChronicleSrvResolver', () => {
    describe('when resolving a host with multiple srv records', () => {
        const records: SrvRecord[] = [
            { name: 'node-b.example.com', port: 35002, priority: 10, weight: 5 },
            { name: 'node-a.example.com', port: 35001, priority: 0, weight: 5 },
            { name: 'node-c.example.com', port: 35003, priority: 0, weight: 10 }
        ];
        const fakeResolver = createFakeResolver(records);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should query the _chronicle._tcp SRV name', async () => {
            await resolver.resolve('cluster.example.com');
            expect(fakeResolver.resolveSrv).toHaveBeenCalledWith('_chronicle._tcp.cluster.example.com');
        });

        it('should sort ascending by priority then descending by weight', async () => {
            const addresses = await resolver.resolve('cluster.example.com');
            expect(addresses).toEqual([
                { host: 'node-c.example.com', port: 35003 },
                { host: 'node-a.example.com', port: 35001 },
                { host: 'node-b.example.com', port: 35002 }
            ]);
        });
    });

    describe('when a srv target has a trailing dot', () => {
        const fakeResolver = createFakeResolver([{ name: 'node-a.example.com.', port: 35001, priority: 0, weight: 0 }]);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should strip the trailing dot', async () => {
            const addresses = await resolver.resolve('cluster.example.com');
            expect(addresses[0].host).toBe('node-a.example.com');
        });
    });

    describe('when no srv records are found', () => {
        const fakeResolver = createFakeResolver([]);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should throw a ChronicleSrvResolutionError', async () => {
            await expect(resolver.resolve('cluster.example.com')).rejects.toThrow(ChronicleSrvResolutionError);
        });
    });

    describe('when a srvNameServer is specified without a port', () => {
        const fakeResolver = createFakeResolver([{ name: 'node-a.example.com', port: 35001, priority: 0, weight: 0 }]);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should default the name server port to 53', async () => {
            await resolver.resolve('cluster.example.com', '127.0.0.1');
            expect(fakeResolver.setServers).toHaveBeenCalledWith(['127.0.0.1:53']);
        });
    });

    describe('when a srvNameServer is specified with a port', () => {
        const fakeResolver = createFakeResolver([{ name: 'node-a.example.com', port: 35001, priority: 0, weight: 0 }]);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should use the given port', async () => {
            await resolver.resolve('cluster.example.com', '127.0.0.1:5353');
            expect(fakeResolver.setServers).toHaveBeenCalledWith(['127.0.0.1:5353']);
        });
    });

    describe('when no srvNameServer is specified', () => {
        const fakeResolver = createFakeResolver([{ name: 'node-a.example.com', port: 35001, priority: 0, weight: 0 }]);
        const resolver = new ChronicleSrvResolver(() => fakeResolver as never);

        it('should not configure custom servers', async () => {
            await resolver.resolve('cluster.example.com');
            expect(fakeResolver.setServers).not.toHaveBeenCalled();
        });
    });

    describe('when resolving twice', () => {
        const records: SrvRecord[] = [{ name: 'node-a.example.com', port: 35001, priority: 0, weight: 0 }];
        let resolverCreationCount = 0;
        const resolver = new ChronicleSrvResolver(() => {
            resolverCreationCount++;
            return createFakeResolver(records) as never;
        });

        it('should create a fresh resolver for each call, never caching results', async () => {
            await resolver.resolve('cluster.example.com');
            await resolver.resolve('cluster.example.com');
            expect(resolverCreationCount).toBe(2);
        });
    });
});
