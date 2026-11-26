// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { AuthenticationMode, ChronicleConnectionString, ChronicleConnectionStringBuilder } from './ChronicleConnectionString.js';
import { LoadBalancerMode } from './LoadBalancerMode.js';

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

    describe('when building a connection string with tls validation not skipped', () => {
        const builder = new ChronicleConnectionStringBuilder();
        builder.host = 'localhost';
        builder.port = 35000;
        builder.skipTlsValidation = false;

        it('should include skipTlsValidation in the query string', () => expect(builder.build()).toBe('chronicle://localhost:35000?skipTlsValidation=false'));
    });

    describe('when tracking whether skipTlsValidation was explicit', () => {
        it('should be omitted by default and require validation', () => {
            const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000');
            expect(builder.hasExplicitSkipTlsValidation).toBe(false);
            expect(builder.skipTlsValidation).toBe(false);
            expect(builder.build()).toBe('chronicle://localhost:35000');
        });
        it('should keep an explicit true explicit and round trip it', () => {
            const builder = new ChronicleConnectionStringBuilder('chronicle://localhost:35000?skipTlsValidation=true');
            expect(builder.hasExplicitSkipTlsValidation).toBe(true);
            expect(builder.skipTlsValidation).toBe(true);
            expect(new ChronicleConnectionString(builder.build()).hasExplicitSkipTlsValidation).toBe(true);
            expect(builder.build()).toBe('chronicle://localhost:35000?skipTlsValidation=true');
        });
        it('should keep an explicit false explicit, requiring validation', () => {
            const connectionString = new ChronicleConnectionString('chronicle://localhost:35000?skipTlsValidation=false');
            expect(connectionString.hasExplicitSkipTlsValidation).toBe(true);
            expect(connectionString.skipTlsValidation).toBe(false);
        });
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

describe('ChronicleConnectionStringBuilder options', () => {
    describe('when parsing caCertificatePath', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?caCertificatePath=%2Fetc%2Fca.pem');
        it('should have the decoded path', () => expect(builder.caCertificatePath).toBe('/etc/ca.pem'));
    });

    describe('when caCertificatePath holds an at sign', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?caCertificatePath=%2Fhome%2Fme@corp%2Fca.pem');
        it('should keep it', () => expect(builder.caCertificatePath).toBe('/home/me@corp/ca.pem'));
    });

    describe('when parsing auth=none together with credentials', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://user:pass@host:35000?auth=none');
        it('should be flagged as no authentication', () => expect(builder.noAuthentication).toBe(true));
        it('should beat the credentials', () => expect(builder.authenticationMode).toBe(AuthenticationMode.None));
    });

    describe('when auth=none is spelled in another case', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?AUTH=None');
        it('should still be no authentication', () => expect(builder.noAuthentication).toBe(true));
    });

    describe('when there are no credentials', () => {
        it('should use the development client credentials', () =>
            expect(new ChronicleConnectionStringBuilder('chronicle://host:35000').authenticationMode).toBe(AuthenticationMode.ClientCredentials));
    });

    describe('when only a username is given', () => {
        it('should throw', () =>
            expect(() => new ChronicleConnectionStringBuilder('chronicle://user@host:35000').authenticationMode).toThrow());
    });

    describe('when parsing skipCompatibilityCheck and skipKeepAlive', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?skipCompatibilityCheck=true&skipKeepAlive=true');
        it('should skip the compatibility check', () => expect(builder.skipCompatibilityCheck).toBe(true));
        it('should skip the keep-alive', () => expect(builder.skipKeepAlive).toBe(true));
    });

    describe('when the new flags are absent', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000');
        it('should not skip the compatibility check', () => expect(builder.skipCompatibilityCheck).toBe(false));
        it('should not be no authentication', () => expect(builder.noAuthentication).toBe(false));
        it('should have no CA certificate path', () => expect(builder.caCertificatePath).toBeUndefined());
    });

    describe('when a boolean option is neither true nor false', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?skipTlsValidation=maybe');
        it('should throw naming the option', () => expect(() => builder.skipTlsValidation).toThrow(/skipTlsValidation/));
    });

    describe('when option names are spelled in another case', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?APIKEY=abc&SkipTlsValidation=false&DISABLETLS=TRUE');
        it('should read the api key', () => expect(builder.apiKey).toBe('abc'));
        it('should read skipTlsValidation', () => expect(builder.skipTlsValidation).toBe(false));
        it('should read disableTls', () => expect(builder.disableTls).toBe(true));
    });

    describe('when percent-decoding option values', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000?apiKey=a%2Bb+c%3D');
        it('should decode once and keep a literal plus', () => expect(builder.apiKey).toBe('a+b+c='));
    });

    describe('when user information spilled an unencoded separator into the query', () => {
        it('should throw', () =>
            expect(() => new ChronicleConnectionStringBuilder('chronicle://user:pa?ss@host:35000')).toThrow(/percent-encoded/));
        it('should throw for an at sign in an option that cannot hold one', () =>
            expect(() => new ChronicleConnectionStringBuilder('chronicle://host:35000?disableTls=x@y')).toThrow(/percent-encoded/));
    });

    describe('when building credentials containing reserved characters', () => {
        const builder = new ChronicleConnectionStringBuilder('chronicle://host:35000');
        builder.username = 'al@ice';
        builder.password = 'p:ss/w?rd';
        const roundTripped = new ChronicleConnectionStringBuilder(builder.build());
        it('should round trip the username', () => expect(roundTripped.username).toBe('al@ice'));
        it('should round trip the password', () => expect(roundTripped.password).toBe('p:ss/w?rd'));
    });

    describe('when round tripping every option', () => {
        const original = 'chronicle://host:35000?auth=none&disableTls=true&skipCompatibilityCheck=true&skipKeepAlive=true' +
            '&certificatePath=%2Fc.p12&certificatePassword=pw&caCertificatePath=%2Fca.pem&custom=value';
        it('should reproduce it', () => expect(new ChronicleConnectionStringBuilder(original).build()).toBe(original));
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

        it('should skip tls validation explicitly', () => {
            expect(Development.skipTlsValidation).toBe(true);
            expect(Development.hasExplicitSkipTlsValidation).toBe(true);
            expect(new ChronicleConnectionString(Development.toString()).skipTlsValidation).toBe(true);
            expect(Development.serverAddress).toEqual({ host: 'localhost', port: 35000 });
        });
        it('should use the development client credentials', () => expect(Development.username).toBe(ChronicleConnectionString.DEVELOPMENT_CLIENT));
    });

    describe('when using the default connection string', () => {
        it('should require validation without an explicit setting', () => {
            expect(ChronicleConnectionString.Default.skipTlsValidation).toBe(false);
            expect(ChronicleConnectionString.Default.hasExplicitSkipTlsValidation).toBe(false);
            expect(ChronicleConnectionString.Default.toString()).toBe('chronicle://localhost:35000');
        });
    });

    describe('when creating credentials without skipTlsValidation specified', () => {
        it('should validate a remote server certificate by default', async () => {
            vi.resetModules();
            const createSsl = vi.fn().mockReturnValue('secure-credentials');
            const createInsecure = vi.fn();
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString.js');
            const connectionString = new MockedChronicleConnectionString('chronicle://untrusted.example.com:35000');
            const credentials = connectionString.createCredentials();

            expect(createSsl).toHaveBeenCalledWith();
            expect(createInsecure).not.toHaveBeenCalled();
            expect(credentials).toBe('secure-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });

    describe('when creating credentials with skipTlsValidation explicitly true', () => {
        it('should skip certificate chain validation', async () => {
            vi.resetModules();
            const createSsl = vi.fn().mockReturnValue('insecure-tls-credentials');
            const createInsecure = vi.fn();
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString.js');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000/?skipTlsValidation=true');
            const credentials = connectionString.createCredentials();

            expect(createSsl).toHaveBeenCalledWith(null, null, null, { rejectUnauthorized: false });
            expect(createInsecure).not.toHaveBeenCalled();
            expect(credentials).toBe('insecure-tls-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });

    describe('when creating credentials with skipTlsValidation explicitly false', () => {
        it('should validate the certificate chain', async () => {
            vi.resetModules();
            const createSsl = vi.fn().mockReturnValue('secure-credentials');
            const createInsecure = vi.fn();
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString.js');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000/?skipTlsValidation=false');
            const credentials = connectionString.createCredentials();

            expect(createSsl).toHaveBeenCalledWith();
            expect(credentials).toBe('secure-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });

    describe('when creating credentials with disableTls', () => {
        it('should create insecure credentials', async () => {
            vi.resetModules();
            const createSsl = vi.fn();
            const createInsecure = vi.fn().mockReturnValue('plaintext-credentials');
            vi.doMock('@grpc/grpc-js', () => ({ credentials: { createSsl, createInsecure } }));

            const { ChronicleConnectionString: MockedChronicleConnectionString } = await import('./ChronicleConnectionString.js');
            const connectionString = new MockedChronicleConnectionString('chronicle://localhost:35000/?disableTls=true');
            const credentials = connectionString.createCredentials();

            expect(createInsecure).toHaveBeenCalled();
            expect(createSsl).not.toHaveBeenCalled();
            expect(credentials).toBe('plaintext-credentials');
            vi.doUnmock('@grpc/grpc-js');
        });
    });
});
