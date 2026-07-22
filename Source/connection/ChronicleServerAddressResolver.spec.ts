// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ChronicleConnectionString } from './ChronicleConnectionString';
import { ChronicleServerAddressResolver } from './ChronicleServerAddressResolver';
import type { ChronicleSrvResolver } from './ChronicleSrvResolver';

describe('ChronicleServerAddressResolver', () => {
    describe('when resolving a plain multi-host connection string', () => {
        const fakeSrvResolver = { resolve: vi.fn() };
        const resolver = new ChronicleServerAddressResolver(fakeSrvResolver as unknown as ChronicleSrvResolver);
        const connectionString = new ChronicleConnectionString('chronicle://host1:35001,host2:35002');

        it('should pass through the parsed hosts unchanged', async () => {
            const addresses = await resolver.resolve(connectionString);
            expect(addresses).toEqual([{ host: 'host1', port: 35001 }, { host: 'host2', port: 35002 }]);
        });

        it('should never touch DNS', async () => {
            await resolver.resolve(connectionString);
            expect(fakeSrvResolver.resolve).not.toHaveBeenCalled();
        });
    });

    describe('when resolving a chronicle+srv connection string', () => {
        const fakeSrvResolver = { resolve: vi.fn().mockResolvedValue([{ host: 'node-a', port: 35001 }, { host: 'node-b', port: 35002 }]) };
        const resolver = new ChronicleServerAddressResolver(fakeSrvResolver as unknown as ChronicleSrvResolver);
        const connectionString = new ChronicleConnectionString('chronicle+srv://cluster.example.com/?srvNameServer=127.0.0.1:5353');

        it('should delegate to the srv resolver with the srv host and name server', async () => {
            await resolver.resolve(connectionString);
            expect(fakeSrvResolver.resolve).toHaveBeenCalledWith('cluster.example.com', '127.0.0.1:5353');
        });

        it('should return the resolved addresses', async () => {
            const addresses = await resolver.resolve(connectionString);
            expect(addresses).toEqual([{ host: 'node-a', port: 35001 }, { host: 'node-b', port: 35002 }]);
        });
    });
});
