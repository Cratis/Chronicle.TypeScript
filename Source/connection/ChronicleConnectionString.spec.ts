// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { AuthenticationMode, ChronicleConnectionString, ChronicleConnectionStringBuilder } from './ChronicleConnectionString';
import { LoadBalancerMode } from './LoadBalancerMode';

describe('ChronicleConnectionStringBuilder', () => {
    describe('when parsing a single host', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000');

        it('should have the host', () => expect(builder.host).toBe('localhost'));
        it('should have the port', () => expect(builder.port).toBe(35000));
        it('should have one server address', () => expect(builder.hosts).toEqual([{ host: 'localhost', port: 35000 }]));
        it('should not be srv', () => expect(builder.isSrv).toBe(false));
    });

    describe('when parsing a host without an explicit port', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost');

        it('should default the port to 35000', () => expect(builder.port).toBe(35000));
    });

    describe('when parsing multiple hosts', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host1:35001,host2,host3:35003');

        it('should have the first host as host', () => expect(builder.host).toBe('host1'));
        it('should have the first port as port', () => expect(builder.port).toBe(35001));
        it('should have three server addresses', () => expect(builder.hosts).toHaveLength(3));
        it('should have the first server address', () => expect(builder.hosts[0]).toEqual({ host: 'host1', port: 35001 }));
        it('should default the second host port', () => expect(builder.hosts[1]).toEqual({ host: 'host2', port: 35000 }));
        it('should have the third server address', () => expect(builder.hosts[2]).toEqual({ host: 'host3', port: 35003 }));
    });

    describe('when parsing multiple hosts with authentication and options', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://admin:secret@host1,host2:35002/?skipTlsValidation=true');

        it('should have the username', () => expect(builder.username).toBe('admin'));
        it('should have the password', () => expect(builder.password).toBe('secret'));
        it('should have two server addresses', () => expect(builder.hosts).toHaveLength(2));
        it('should default the first host port', () => expect(builder.hosts[0]).toEqual({ host: 'host1', port: 35000 }));
        it('should have the second server address', () => expect(builder.hosts[1]).toEqual({ host: 'host2', port: 35002 }));
        it('should skip tls validation', () => expect(builder.skipTlsValidation).toBe(true));
    });

    describe('when parsing an IPv6 host in a multi-host list', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://[::1]:35001,host2');

        it('should have the bracketed host without brackets', () => expect(builder.hosts[0]).toEqual({ host: '::1', port: 35001 }));
        it('should have the second host', () => expect(builder.hosts[1]).toEqual({ host: 'host2', port: 35000 }));
    });

    describe('when parsing an IPv6 host without an explicit port', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://[::1]');

        it('should default the port', () => expect(builder.hosts[0]).toEqual({ host: '::1', port: 35000 }));
    });

    describe('when parsing a srv url', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle+srv://cluster.example.com');

        it('should have the srv scheme', () => expect(builder.scheme).toBe('chronicle+srv'));
        it('should be srv', () => expect(builder.isSrv).toBe(true));
        it('should have the correct host', () => expect(builder.host).toBe('cluster.example.com'));
        it('should have the default port', () => expect(builder.port).toBe(35000));
    });

    describe('when parsing a srv url with multiple hosts', () => {
        it('should throw', () => expect(() => new ChronicleConnectionStringBuilder('chronicle+srv://host1,host2')).toThrow());
    });

    describe('when parsing a srv url with a name server', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle+srv://cluster.example.com/?srvNameServer=127.0.0.1:5353');

        it('should be srv', () => expect(builder.isSrv).toBe(true));
        it('should have the name server', () => expect(builder.srvNameServer).toBe('127.0.0.1:5353'));
        it('should include the name server when building', () =>
            expect(builder.build()).toBe('chronicle+srv://cluster.example.com:35000?srvNameServer=127.0.0.1%3A5353'));
    });

    describe('when parsing a url with a trailing slash before the query string', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000/?apiKey=my-key');

        it('should still parse the host', () => expect(builder.host).toBe('localhost'));
        it('should still parse the query string', () => expect(builder.apiKey).toBe('my-key'));
    });

    describe('when parsing a url with a load balancer option', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host1,host2/?loadBalancer=random');

        it('should have the load balancer', () => expect(builder.loadBalancer).toBe(LoadBalancerMode.Random));
        it('should include the load balancer when building', () =>
            expect(builder.build()).toBe('chronicle://host1:35000,host2:35000?loadBalancer=random'));
    });

    describe('when no load balancer option is given', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000');

        it('should default to least-connections', () => expect(builder.loadBalancer).toBe(LoadBalancerMode.LeastConnections));
    });

    describe('when parsing a url with an unknown load balancer option', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000/?loadBalancer=nonsense');

        it('should throw', () => expect(() => builder.loadBalancer).toThrow());
    });

    describe('when building a connection string with multiple hosts', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.hosts = [{ host: 'host1', port: 35001 }, { host: 'host2', port: 35000 }];

        it('should include all hosts in the url', () => expect(builder.build()).toBe('chronicle://host1:35001,host2:35000'));
        it('should round-trip through parsing', () => expect(new ChronicleConnectionStringBuilder(builder.build()).hosts).toEqual(builder.hosts));
    });

    describe('when building a connection string with an IPv6 host', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.hosts = [{ host: '::1', port: 35000 }];

        it('should bracket the IPv6 host', () => expect(builder.build()).toBe('chronicle://[::1]:35000'));
    });

    describe('when building a connection string with tls validation skipped', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.host = 'localhost';
        builder.port = 35000;
        builder.skipTlsValidation = true;

        it('should include skipTlsValidation in the query string', () => expect(builder.build()).toBe('chronicle://localhost:35000?skipTlsValidation=true'));
    });

    describe('when setting host after hosts were set to multiple servers', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.hosts = [{ host: 'host1', port: 35001 }, { host: 'host2', port: 35002 }];
        builder.host = 'newhost';

        it('should collapse to a single server', () => expect(builder.hosts).toEqual([{ host: 'newhost', port: 35001 }]));
    });

    describe('when getting authentication mode with client credentials', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://user:pass@localhost:35000');

        it('should be client credentials', () => expect(builder.authenticationMode).toBe(AuthenticationMode.ClientCredentials));
    });

    describe('when getting authentication mode with an api key', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000/?apiKey=my-key');

        it('should be api key', () => expect(builder.authenticationMode).toBe(AuthenticationMode.ApiKey));
    });

    describe('when getting authentication mode with both credentials and an api key', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://user:pass@localhost:35000/?apiKey=my-key');

        it('should throw', () => expect(() => builder.authenticationMode).toThrow());
    });
});

describe('ChronicleConnectionString', () => {
    describe('when parsing a connection string with multiple hosts', () => {
        const connectionString = new ChronicleConnectionString('chronicle://host1:35001,host2:35002');

        it('should have all server addresses', () =>
            expect(connectionString.serverAddresses).toEqual([{ host: 'host1', port: 35001 }, { host: 'host2', port: 35002 }]));
        it('should have the first as the convenience server address', () =>
            expect(connectionString.serverAddress).toEqual({ host: 'host1', port: 35001 }));
    });

    describe('when using the development connection string', () => {
        const { Development } = ChronicleConnectionString;

        it('should skip tls validation', () => expect(Development.skipTlsValidation).toBe(true));
        it('should use the development client credentials', () => expect(Development.username).toBe(ChronicleConnectionString.DEVELOPMENT_CLIENT));
    });

    describe('when creating credentials without skipTlsValidation', () => {
        it('should validate the certificate chain', async () => {
            vi.resetModules();
            const createSsl = vi.fn().mockReturnValue('secure-credentials');
            const createInsecure = vi.fn();
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000');
            const credentials = connectionString.createCredentials();

            expect(createSsl).toHaveBeenCalledWith();
            expect(credentials).toBe('secure-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });

    describe('when creating credentials with skipTlsValidation', () => {
        it('should skip certificate chain validation', async () => {
            vi.resetModules();
            const createSsl = vi.fn().mockReturnValue('insecure-tls-credentials');
            const createInsecure = vi.fn();
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000/?skipTlsValidation=true');
            const credentials = connectionString.createCredentials();

            expect(createSsl).toHaveBeenCalledWith(null, null, null, { rejectUnauthorized: false });
            expect(credentials).toBe('insecure-tls-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });

    describe('when creating credentials with disableTls', () => {
        it('should create insecure credentials', async () => {
            vi.resetModules();
            const createSsl = vi.fn();
            const createInsecure = vi.fn().mockReturnValue('plaintext-credentials');
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000/?disableTls=true');
            const credentials = connectionString.createCredentials();

            expect(createInsecure).toHaveBeenCalled();
            expect(createSsl).not.toHaveBeenCalled();
            expect(credentials).toBe('plaintext-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });
});
