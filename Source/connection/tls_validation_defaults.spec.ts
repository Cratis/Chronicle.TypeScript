// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventEmitter } from 'node:events';
import * as https from 'https';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChronicleConnection } from './ChronicleConnection.js';
import { ChronicleConnectionString } from './ChronicleConnectionString.js';
import { ChronicleTlsMaterial } from './ChronicleTlsMaterial.js';
import * as loadBalancing from './LoadBalancerStrategyFactory.js';
import * as tokenProviders from './TokenProvider.js';

vi.mock('https', () => ({ request: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

const settings = [
    { name: 'omitted', query: '', skip: false },
    { name: 'explicitly false', query: '?skipTlsValidation=false', skip: false },
    { name: 'explicitly true', query: '?skipTlsValidation=true', skip: true }
];

for (const setting of settings) {
    describe(`when skipTlsValidation is ${setting.name}`, () => {
        it('should pass the effective setting to OAuth and load balancing', async () => {
            const oauth = vi.spyOn(tokenProviders, 'OAuthTokenProvider');
            const balancing = vi.spyOn(loadBalancing, 'createLoadBalancerStrategy');
            const connectOptions = vi.spyOn(ChronicleTlsMaterial.prototype, 'connectOptions');
            const connection = new ChronicleConnection({
                connectionString: `chronicle://untrusted.example.com:35000${setting.query}`,
                deferClientCreation: true
            });
            try {
                await connection.resetChannel();
                expect(oauth).toHaveBeenCalledWith('https://untrusted.example.com:35000/connect/token',
                    expect.any(String), expect.any(String), setting.skip, undefined, ChronicleTlsMaterial.None);
                expect(balancing).toHaveBeenCalledWith(connection.connectionString.loadBalancer, setting.skip, ChronicleTlsMaterial.None);
                expect(connectOptions).toHaveBeenCalledWith(setting.skip);
                expect(connectOptions).toHaveReturnedWith({ rejectUnauthorized: !setting.skip });
            } finally {
                connection.dispose();
            }
        });

        it('should use the effective setting on the HTTPS token request', async () => {
            const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
            request.end.mockImplementation(() => { request.emit('error', new Error('untrusted certificate')); });
            vi.mocked(https.request).mockReturnValue(request as unknown as ReturnType<typeof https.request>);
            const connectionString = new ChronicleConnectionString(`chronicle://untrusted.example.com:35000${setting.query}`);
            const provider = new tokenProviders.OAuthTokenProvider('https://untrusted.example.com/connect/token',
                'test-client', 'test-secret', connectionString.skipTlsValidation);

            await expect(provider.getAccessToken()).rejects.toThrow('untrusted certificate');

            expect(https.request).toHaveBeenCalledTimes(1);
            const options = vi.mocked(https.request).mock.calls[0][1] as https.RequestOptions;
            expect(options.rejectUnauthorized ?? true).toBe(!setting.skip);
        });
    });
}

describe('when the token provider has no explicit TLS setting', () => {
    it('should require validation and propagate a certificate failure without retrying insecurely', async () => {
        const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
        request.end.mockImplementation(() => { request.emit('error', new Error('untrusted certificate')); });
        vi.mocked(https.request).mockReturnValue(request as unknown as ReturnType<typeof https.request>);
        const provider = new tokenProviders.OAuthTokenProvider('https://untrusted.example.com/connect/token', 'test-client', 'test-secret');

        await expect(provider.getAccessToken()).rejects.toThrow('untrusted certificate');

        expect(https.request).toHaveBeenCalledTimes(1);
        const options = vi.mocked(https.request).mock.calls[0][1] as https.RequestOptions;
        expect(options.rejectUnauthorized).not.toBe(false);
    });
});
