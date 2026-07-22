// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as grpc from '@grpc/grpc-js';
import { formatServerAddress } from './formatServerAddress';
import { LoadBalancerMode } from './LoadBalancerMode';

const DEFAULT_PORT = 35000;
const SRV_SCHEME = 'chronicle+srv';

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
 * Splits a `host1:port1,host2:port2` host list on top-level commas, leaving commas that
 * appear inside IPv6 bracket literals (`[::1]:35000`) intact.
 */
function splitHostList(value: string): string[] {
    const entries: string[] = [];
    let depth = 0;
    let current = '';

    for (const character of value) {
        if (character === '[') {
            depth++;
        } else if (character === ']') {
            depth--;
        }

        if (character === ',' && depth === 0) {
            entries.push(current);
            current = '';
            continue;
        }

        current += character;
    }

    if (current.length > 0) {
        entries.push(current);
    }

    return entries;
}

/**
 * Parses a single `host:port` or `[ipv6]:port` entry, defaulting the port when omitted.
 */
function parseHostAndPort(entry: string): ChronicleServerAddress {
    const trimmed = entry.trim();
    let host: string;
    let portPart: string;

    if (trimmed.startsWith('[')) {
        const closingIndex = trimmed.indexOf(']');
        if (closingIndex === -1) {
            throw new Error(`Invalid server address: ${trimmed}`);
        }

        host = trimmed.slice(1, closingIndex);
        portPart = trimmed.slice(closingIndex + 1).replace(/^:/, '');
    } else {
        const colonIndex = trimmed.lastIndexOf(':');
        host = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
        portPart = colonIndex === -1 ? '' : trimmed.slice(colonIndex + 1);
    }

    if (host.length === 0) {
        throw new Error(`Invalid server address: ${trimmed}`);
    }

    if (portPart.length === 0) {
        return { host, port: DEFAULT_PORT };
    }

    const port = Number(portPart);
    if (!Number.isInteger(port)) {
        throw new Error(`Invalid server address: ${trimmed}`);
    }

    return { host, port };
}

/**
 * Builder for constructing Chronicle connection strings.
 */
export class ChronicleConnectionStringBuilder {
    private static readonly _defaultPort = DEFAULT_PORT;
    private static readonly _usernameKey = 'Username';
    private static readonly _passwordKey = 'Password';
    private static readonly _schemeKey = 'Scheme';
    private static readonly _apiKeyKey = 'apiKey';
    private static readonly _disableTlsKey = 'disableTls';
    private static readonly _skipTlsValidationKey = 'skipTlsValidation';
    private static readonly _certificatePathKey = 'certificatePath';
    private static readonly _certificatePasswordKey = 'certificatePassword';
    private static readonly _loadBalancerKey = 'loadBalancer';
    private static readonly _srvNameServerKey = 'srvNameServer';

    private readonly _properties = new Map<string, string>();
    private _hosts: ChronicleServerAddress[] = [];

    constructor(connectionString?: string) {
        if (connectionString) {
            this.parseConnectionString(connectionString);
        }
    }

    get hosts(): ChronicleServerAddress[] {
        return this._hosts.length > 0 ? this._hosts : [{ host: 'localhost', port: ChronicleConnectionStringBuilder._defaultPort }];
    }

    set hosts(value: ChronicleServerAddress[]) {
        this._hosts = value;
    }

    /**
     * Convenience accessor for the first host in {@link hosts}. Setting it collapses the
     * configuration to that single host, discarding any others previously set via
     * {@link hosts} - the same "single server" reset a plain host/port connection string
     * implies.
     */
    get host(): string {
        return this.hosts[0].host;
    }

    set host(value: string) {
        this._hosts = [{ host: value, port: this.hosts[0].port }];
    }

    /**
     * Convenience accessor for the first host's port in {@link hosts}. Setting it collapses
     * the configuration to that single host, discarding any others previously set via
     * {@link hosts}.
     */
    get port(): number {
        return this.hosts[0].port;
    }

    set port(value: number) {
        this._hosts = [{ host: this.hosts[0].host, port: value }];
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

    /**
     * Whether the connection string uses the DNS SRV lookup scheme (`chronicle+srv://`).
     * Compared case-insensitively, matching {@link scheme}'s own parsing.
     */
    get isSrv(): boolean {
        return this.scheme.toLowerCase() === SRV_SCHEME;
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

    /**
     * Whether TLS certificate validation is skipped for the gRPC channel and OAuth token
     * requests. Distinct from {@link disableTls}, which controls whether TLS is used at
     * all. Defaults to `true` - set to `false` to require full certificate validation
     * whenever TLS is on.
     */
    get skipTlsValidation(): boolean {
        const raw = this._properties.get(ChronicleConnectionStringBuilder._skipTlsValidationKey);
        return raw === undefined || raw === 'true';
    }

    set skipTlsValidation(value: boolean) {
        this._properties.set(ChronicleConnectionStringBuilder._skipTlsValidationKey, value.toString());
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

    /**
     * The strategy used to select one address from {@link hosts} (or the addresses
     * resolved from a `chronicle+srv://` host) on every connect/reconnect attempt.
     * Defaults to {@link LoadBalancerMode.LeastConnections}.
     */
    get loadBalancer(): LoadBalancerMode {
        const raw = this._properties.get(ChronicleConnectionStringBuilder._loadBalancerKey);
        if (!raw) {
            return LoadBalancerMode.LeastConnections;
        }

        const knownModes = Object.values(LoadBalancerMode) as string[];
        if (!knownModes.includes(raw)) {
            throw new Error(`Unknown loadBalancer strategy '${raw}'. Expected one of: ${knownModes.join(', ')}`);
        }

        return raw as LoadBalancerMode;
    }

    set loadBalancer(value: LoadBalancerMode) {
        this._properties.set(ChronicleConnectionStringBuilder._loadBalancerKey, value);
    }

    /**
     * The `host[:port]` DNS name server used to resolve `chronicle+srv://` SRV records.
     * Defaults to port 53 when no port is given. Undefined uses the system default
     * resolver.
     */
    get srvNameServer(): string | undefined {
        return this._properties.get(ChronicleConnectionStringBuilder._srvNameServerKey);
    }

    set srvNameServer(value: string | undefined) {
        if (value) {
            this._properties.set(ChronicleConnectionStringBuilder._srvNameServerKey, value);
            return;
        }

        this._properties.delete(ChronicleConnectionStringBuilder._srvNameServerKey);
    }

    build(): string {
        if (this.isSrv && this.hosts.length > 1) {
            throw new Error(`${SRV_SCHEME} connection strings support only a single host, found ${this.hosts.length}`);
        }

        let result = `${this.scheme}://`;

        if (this.username) {
            result += this.username;
            if (this.password) {
                result += `:${this.password}`;
            }
            result += '@';
        }

        result += this.hosts.map(formatServerAddress).join(',');

        const queryParameters: string[] = [];

        if (this.apiKey) {
            queryParameters.push(`apiKey=${encodeURIComponent(this.apiKey)}`);
        }

        if (this.disableTls) {
            queryParameters.push('disableTls=true');
        }

        if (!this.skipTlsValidation) {
            queryParameters.push('skipTlsValidation=false');
        }

        if (this.certificatePath) {
            queryParameters.push(`certificatePath=${encodeURIComponent(this.certificatePath)}`);
        }

        if (this.certificatePassword) {
            queryParameters.push(`certificatePassword=${encodeURIComponent(this.certificatePassword)}`);
        }

        if (this._properties.has(ChronicleConnectionStringBuilder._loadBalancerKey)) {
            queryParameters.push(`loadBalancer=${encodeURIComponent(this.loadBalancer)}`);
        }

        if (this.srvNameServer) {
            queryParameters.push(`srvNameServer=${encodeURIComponent(this.srvNameServer)}`);
        }

        for (const [key, value] of this._properties) {
            if (
                key !== ChronicleConnectionStringBuilder._usernameKey &&
                key !== ChronicleConnectionStringBuilder._passwordKey &&
                key !== ChronicleConnectionStringBuilder._schemeKey &&
                key !== ChronicleConnectionStringBuilder._apiKeyKey &&
                key !== ChronicleConnectionStringBuilder._disableTlsKey &&
                key !== ChronicleConnectionStringBuilder._skipTlsValidationKey &&
                key !== ChronicleConnectionStringBuilder._certificatePathKey &&
                key !== ChronicleConnectionStringBuilder._certificatePasswordKey &&
                key !== ChronicleConnectionStringBuilder._loadBalancerKey &&
                key !== ChronicleConnectionStringBuilder._srvNameServerKey
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
        const lowerCased = connectionString.toLowerCase();
        if (lowerCased.startsWith('chronicle://') || lowerCased.startsWith(`${SRV_SCHEME}://`)) {
            this.parseUrl(connectionString);
        }
    }

    private parseUrl(value: string): void {
        try {
            const schemeSeparatorIndex = value.indexOf('://');
            const scheme = value.slice(0, schemeSeparatorIndex);
            this.scheme = scheme;

            const rest = value.slice(schemeSeparatorIndex + 3);

            // The authority (userinfo + hosts) ends at the first '/' or '?'; parsing tolerates
            // an optional trailing slash immediately before the query string this way.
            const pathIndex = [rest.indexOf('/'), rest.indexOf('?')]
                .filter(index => index >= 0)
                .sort((first, second) => first - second)[0];
            const authority = pathIndex === undefined ? rest : rest.slice(0, pathIndex);
            let query = '';
            if (pathIndex !== undefined) {
                const queryIndex = rest.indexOf('?', pathIndex);
                query = queryIndex === -1 ? '' : rest.slice(queryIndex + 1);
            }

            // The userinfo separator is the LAST '@' in the authority, so a host portion never
            // legitimately containing '@' can't be confused for one.
            const authoritySeparatorIndex = authority.lastIndexOf('@');
            let hostList = authority;
            if (authoritySeparatorIndex >= 0) {
                const userInfo = authority.slice(0, authoritySeparatorIndex);
                hostList = authority.slice(authoritySeparatorIndex + 1);

                const parts = userInfo.split(':');
                this.username = decodeURIComponent(parts[0]);
                if (parts.length > 1) {
                    this.password = decodeURIComponent(parts[1]);
                }
            }

            const hosts = splitHostList(hostList).map(parseHostAndPort);
            if (this.isSrv && hosts.length > 1) {
                throw new Error(`${SRV_SCHEME} connection strings support only a single host, found ${hosts.length}`);
            }
            this.hosts = hosts;

            for (const [key, queryValue] of new URLSearchParams(query)) {
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
    // skipTlsValidation defaults to true, so no explicit query parameter is needed here for
    // this to connect to the Kernel's self-signed development certificate.
    static readonly Development = new ChronicleConnectionString(
        `chronicle://${ChronicleConnectionString.DEVELOPMENT_CLIENT}:${ChronicleConnectionString.DEVELOPMENT_CLIENT_SECRET}@localhost:35000`
    );

    private readonly _builder: ChronicleConnectionStringBuilder;
    private readonly _serverAddresses: ChronicleServerAddress[];

    constructor(connectionString: string) {
        this._builder = new ChronicleConnectionStringBuilder(connectionString);
        this._serverAddresses = this._builder.hosts;
    }

    /**
     * The connection string's scheme, either `chronicle` or `chronicle+srv`.
     */
    get scheme(): string {
        return this._builder.scheme;
    }

    /**
     * Whether the connection string uses the DNS SRV lookup scheme (`chronicle+srv://`).
     */
    get isSrv(): boolean {
        return this._builder.isSrv;
    }

    /**
     * Convenience accessor for the first entry in {@link serverAddresses}, for callers
     * that only ever expect a single server address.
     */
    get serverAddress(): ChronicleServerAddress {
        return this._serverAddresses[0];
    }

    /**
     * All server addresses parsed from a multi-host `chronicle://` connection string.
     * For `chronicle+srv://` connection strings, this holds the single SRV lookup host,
     * not the resolved addresses - resolve those via {@link ChronicleServerAddressResolver}.
     */
    get serverAddresses(): ChronicleServerAddress[] {
        return this._serverAddresses;
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

    /**
     * Whether TLS certificate validation is skipped. See
     * {@link ChronicleConnectionStringBuilder.skipTlsValidation}.
     */
    get skipTlsValidation(): boolean {
        return this._builder.skipTlsValidation;
    }

    get certificatePath(): string | undefined {
        return this._builder.certificatePath;
    }

    get certificatePassword(): string | undefined {
        return this._builder.certificatePassword;
    }

    /**
     * The strategy used to select one server address on every connect/reconnect attempt.
     */
    get loadBalancer(): LoadBalancerMode {
        return this._builder.loadBalancer;
    }

    /**
     * The `host[:port]` DNS name server used to resolve `chronicle+srv://` SRV records.
     */
    get srvNameServer(): string | undefined {
        return this._builder.srvNameServer;
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

        if (this.skipTlsValidation) {
            // Chronicle generates a self-signed certificate in development, and skipTlsValidation
            // defaults to true so this works without extra configuration. grpc-js has no
            // per-error hook to accept only self-signed/untrusted-root chains the way a
            // finer-grained validator would, so skipTlsValidation bypasses chain validation
            // entirely. Set skipTlsValidation=false for a server with a verifiable certificate.
            return grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false });
        }

        return grpc.credentials.createSsl();
    }

    toString(): string {
        return this._builder.build();
    }
}
