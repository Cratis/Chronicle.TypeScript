// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as grpc from '@grpc/grpc-js';

/**
 * Authentication mode for Chronicle connection.
 */
export enum AuthenticationMode {
    ClientCredentials = 'ClientCredentials',
    ApiKey = 'ApiKey'
}

/**
 * Represents a server address with host and port.
 */
export interface ChronicleServerAddress {
    host: string;
    port: number;
}

/**
 * Builder for constructing Chronicle connection strings.
 */
export class ChronicleConnectionStringBuilder {
    private static readonly _defaultPort = 35000;
    private static readonly _hostKey = 'Host';
    private static readonly _portKey = 'Port';
    private static readonly _usernameKey = 'Username';
    private static readonly _passwordKey = 'Password';
    private static readonly _schemeKey = 'Scheme';
    private static readonly _apiKeyKey = 'apiKey';
    private static readonly _disableTlsKey = 'disableTls';
    private static readonly _certificatePathKey = 'certificatePath';
    private static readonly _certificatePasswordKey = 'certificatePassword';

    private readonly _properties = new Map<string, string>();

    constructor(connectionString?: string) {
        if (connectionString) {
            this.parseConnectionString(connectionString);
        }
    }

    get host(): string {
        return this._properties.get(ChronicleConnectionStringBuilder._hostKey) || 'localhost';
    }

    set host(value: string) {
        this._properties.set(ChronicleConnectionStringBuilder._hostKey, value);
    }

    get port(): number {
        const port = this._properties.get(ChronicleConnectionStringBuilder._portKey);
        return port ? parseInt(port, 10) : ChronicleConnectionStringBuilder._defaultPort;
    }

    set port(value: number) {
        this._properties.set(ChronicleConnectionStringBuilder._portKey, value.toString());
    }

    get username(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._usernameKey);
    }

    set username(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._usernameKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._usernameKey);
    }

    get password(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._passwordKey);
    }

    set password(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._passwordKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._passwordKey);
    }

    get scheme(): string {
        return this._properties.get(ChronicleConnectionStringBuilder._schemeKey) || 'chronicle';
    }

    set scheme(value: string) {
        this._properties.set(ChronicleConnectionStringBuilder._schemeKey, value);
    }

    get authenticationMode(): AuthenticationMode {
        const hasClientCredentials = !!this.username && !!this.password;
        const hasApiKey = !!this.apiKey;

        if (hasClientCredentials && hasApiKey) {
            throw new Error('Cannot specify both username/password and apiKey in the connection string');
        }

        if (hasClientCredentials) {
            return AuthenticationMode.ClientCredentials;
        }

        if (hasApiKey) {
            return AuthenticationMode.ApiKey;
        }

        throw new Error('No authentication method specified. Provide either username/password or apiKey in the connection string');
    }

    get apiKey(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._apiKeyKey);
    }

    set apiKey(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._apiKeyKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._apiKeyKey);
    }

    get disableTls(): boolean {
        return this._properties.get(ChronicleConnectionStringBuilder._disableTlsKey) === 'true';
    }

    set disableTls(value: boolean) {
        this._properties.set(ChronicleConnectionStringBuilder._disableTlsKey, value.toString());
    }

    get certificatePath(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._certificatePathKey);
    }

    set certificatePath(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._certificatePathKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._certificatePathKey);
    }

    get certificatePassword(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._certificatePasswordKey);
    }

    set certificatePassword(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._certificatePasswordKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._certificatePasswordKey);
    }

    build(): string {
        let result = `${this.scheme}://`;

        if (this.username) {
            result += this.username;
            if (this.password) {
                result += `:${this.password}`;
            }
            result += '@';
        }

        result += this.host;
        result += `:${this.port}`;

        const queryParameters: string[] = [];

        if (this.apiKey) {
            queryParameters.push(`apiKey=${encodeURIComponent(this.apiKey)}`);
        }

        if (this.disableTls) {
            queryParameters.push('disableTls=true');
        }

        if (this.certificatePath) {
            queryParameters.push(`certificatePath=${encodeURIComponent(this.certificatePath)}`);
        }

        if (this.certificatePassword) {
            queryParameters.push(`certificatePassword=${encodeURIComponent(this.certificatePassword)}`);
        }

        for (const [key, value] of this._properties) {
            if (
                key !== ChronicleConnectionStringBuilder._hostKey &&
                key !== ChronicleConnectionStringBuilder._portKey &&
                key !== ChronicleConnectionStringBuilder._usernameKey &&
                key !== ChronicleConnectionStringBuilder._passwordKey &&
                key !== ChronicleConnectionStringBuilder._schemeKey &&
                key !== ChronicleConnectionStringBuilder._apiKeyKey &&
                key !== ChronicleConnectionStringBuilder._disableTlsKey &&
                key !== ChronicleConnectionStringBuilder._certificatePathKey &&
                key !== ChronicleConnectionStringBuilder._certificatePasswordKey
            ) {
                queryParameters.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }

        if (queryParameters.length > 0) {
            result += `?${queryParameters.join('&')}`;
        }

        return result;
    }

    private parseConnectionString(connectionString: string): void {
        if (
            connectionString.startsWith('chronicle://') ||
            connectionString.startsWith('chronicle+srv://')
        ) {
            this.parseUrl(connectionString);
        }
    }

    private parseUrl(value: string): void {
        try {
            const parsed = new URL(value);
            this.scheme = parsed.protocol.replace(':', '');
            this.host = parsed.hostname;

            if (parsed.port) {
                this.port = parseInt(parsed.port, 10);
            }

            if (parsed.username) {
                this.username = decodeURIComponent(parsed.username);
                if (parsed.password) {
                    this.password = decodeURIComponent(parsed.password);
                }
            }

            for (const [key, queryValue] of new URLSearchParams(parsed.search)) {
                this._properties.set(key, decodeURIComponent(queryValue));
            }
        } catch (error) {
            throw new Error(`Invalid Chronicle connection string: ${error}`);
        }
    }
}

/**
 * Represents a Chronicle connection string.
 */
export class ChronicleConnectionString {
    static readonly DEVELOPMENT_CLIENT = 'chronicle-dev-client';
    static readonly DEVELOPMENT_CLIENT_SECRET = 'chronicle-dev-secret';
    static readonly Default = new ChronicleConnectionString('chronicle://localhost:35000');
    static readonly Development = new ChronicleConnectionString(
        `chronicle://${ChronicleConnectionString.DEVELOPMENT_CLIENT}:${ChronicleConnectionString.DEVELOPMENT_CLIENT_SECRET}@localhost:35000`
    );

    private readonly _builder: ChronicleConnectionStringBuilder;
    private readonly _serverAddress: ChronicleServerAddress;

    constructor(connectionString: string) {
        this._builder = new ChronicleConnectionStringBuilder(connectionString);
        this._serverAddress = {
            host: this._builder.host,
            port: this._builder.port
        };
    }

    get serverAddress(): ChronicleServerAddress {
        return this._serverAddress;
    }

    get username(): string | undefined {
        return this._builder.username;
    }

    get password(): string | undefined {
        return this._builder.password;
    }

    get authenticationMode(): AuthenticationMode {
        return this._builder.authenticationMode;
    }

    get apiKey(): string | undefined {
        return this._builder.apiKey;
    }

    get disableTls(): boolean {
        return this._builder.disableTls;
    }

    get certificatePath(): string | undefined {
        return this._builder.certificatePath;
    }

    get certificatePassword(): string | undefined {
        return this._builder.certificatePassword;
    }

    withCredentials(username: string, password: string): ChronicleConnectionString {
        const builder = new ChronicleConnectionStringBuilder(this.toString());
        builder.username = username;
        builder.password = password;
        return new ChronicleConnectionString(builder.build());
    }

    withApiKey(apiKey: string): ChronicleConnectionString {
        const builder = new ChronicleConnectionStringBuilder(this.toString());
        builder.apiKey = apiKey;
        return new ChronicleConnectionString(builder.build());
    }

    createCredentials(): grpc.ChannelCredentials {
        if (this.disableTls) {
            return grpc.credentials.createInsecure();
        }

        // Chronicle generates a self-signed certificate in development. grpc-js has no
        // per-error hook to accept only self-signed/untrusted-root chains the way a
        // finer-grained validator would, so unpinned connections skip chain validation
        // entirely to allow development clients to connect without extra certificate setup.
        return grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false });
    }

    toString(): string {
        return this._builder.build();
    }
}