// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { status, type Channel, type ChannelCredentials, type ChannelOptions } from '@grpc/grpc-js';
import { diag } from '@opentelemetry/api';
import {
    ConnectionServiceDefinition,
    ConstraintsDefinition,
    EventSeedingDefinition,
    EventSequencesDefinition,
    EventStoresDefinition,
    EventTypesDefinition,
    ExternalServicesDefinition,
    FailedPartitionsDefinition,
    IdentitiesDefinition,
    JobsDefinition,
    MaterializedReadModelsDefinition,
    NamespacesDefinition,
    ObserversDefinition,
    ProjectionsDefinition,
    ReactorsDefinition,
    ReadModelExplorerDefinition,
    ReadModelsDefinition,
    RecommendationsDefinition,
    ReducersDefinition,
    ServerDefinition,
    WebhooksDefinition,
    type ConnectionServiceClient
} from '@cratis/chronicle.contracts';
import { ComplianceDefinition } from '../compliance/ComplianceContracts.js';
import { createChannel, createClientFactory } from 'nice-grpc';
import type { ClientMiddleware } from 'nice-grpc-common';
import { ClientError, Metadata } from 'nice-grpc-common';
import { EventStoreSubscriptionsDefinition } from '../eventStoreSubscriptions/contracts.js';
import { ChronicleConnectionString, type ChronicleServerAddress } from './ChronicleConnectionString.js';
import { ChronicleServerAddressResolver } from './ChronicleServerAddressResolver.js';
import { ChronicleServices } from './ChronicleServices.js';
import { CompatibilityPreflight } from './CompatibilityPreflight.js';
import { formatServerAddress } from './formatServerAddress.js';
import type { ILoadBalancerStrategy } from './ILoadBalancerStrategy.js';
import { createLoadBalancerStrategy } from './LoadBalancerStrategyFactory.js';
import { ITokenProvider, NoOpTokenProvider, OAuthTokenProvider } from './TokenProvider.js';

/**
 * Configuration options for Chronicle connection.
 */
export interface ChronicleConnectionOptions {
    /**
     * The connection string used to connect to Chronicle.
     */
    connectionString?: string | ChronicleConnectionString;

    /**
     * The host and port of the Chronicle server. Used if connectionString is not provided.
     */
    serverAddress?: string;

    /**
     * Optional gRPC credentials. Defaults to credentials based on the connection string.
     */
    credentials?: ChannelCredentials;

    /**
     * Optional connection timeout in milliseconds. Defaults to 10000.
     */
    connectTimeout?: number;

    /**
     * Optional maximum receive message size in bytes.
     */
    maxReceiveMessageSize?: number;

    /**
     * Optional maximum send message size in bytes.
     */
    maxSendMessageSize?: number;

    /**
     * Optional correlation ID for tracking requests.
     */
    correlationId?: string;

    /**
     * Optional authentication authority URL. If not set, uses the Chronicle server itself.
     */
    authority?: string;
}

/**
 * Manages the gRPC connection to Chronicle and exposes the generated service clients.
 */
export class ChronicleConnection implements ChronicleServices {
    private _channel!: Channel;
    private _services!: ChronicleServices;
    private _connections!: ConnectionServiceClient;
    private _compatibility!: CompatibilityPreflight;
    private readonly _connectionString: ChronicleConnectionString;
    private readonly _tokenProviders = new Map<string, ITokenProvider>();
    private readonly _addressResolver: ChronicleServerAddressResolver;
    private readonly _loadBalancerStrategy: ILoadBalancerStrategy;
    private _isConnected = false;
    private _clientsReady: Promise<void>;

    constructor(private readonly _options: ChronicleConnectionOptions) {
        if (_options.connectionString) {
            this._connectionString = typeof _options.connectionString === 'string'
                ? new ChronicleConnectionString(_options.connectionString)
                : _options.connectionString;
        } else if (_options.serverAddress) {
            this._connectionString = new ChronicleConnectionString(`chronicle://${_options.serverAddress}`);
        } else {
            this._connectionString = ChronicleConnectionString.Default;
        }

        if (!this._connectionString.apiKey && (!!this._connectionString.username !== !!this._connectionString.password)) {
            throw new Error('Connection string must contain both username and password, or neither');
        }

        this._addressResolver = new ChronicleServerAddressResolver();
        this._loadBalancerStrategy = createLoadBalancerStrategy(this._connectionString.loadBalancer, this._connectionString.skipTlsValidation);

        this._clientsReady = this.createClients();
        // Building the initial channel is async (address resolution + load balancer
        // selection), so the constructor cannot await it. Real failures still surface to
        // callers that await connect()/resetChannel(); this only prevents an unhandled
        // rejection warning from the fire-and-forget initial build.
        this._clientsReady.catch(() => {});
    }

    get connectionString(): ChronicleConnectionString {
        return this._connectionString;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    get eventStores() {
        return this._services.eventStores;
    }

    get namespaces() {
        return this._services.namespaces;
    }

    get recommendations() {
        return this._services.recommendations;
    }

    get identities() {
        return this._services.identities;
    }

    get eventSequences() {
        return this._services.eventSequences;
    }

    get eventTypes() {
        return this._services.eventTypes;
    }

    get constraints() {
        return this._services.constraints;
    }

    get observers() {
        return this._services.observers;
    }

    get eventStoreSubscriptions() {
        return this._services.eventStoreSubscriptions;
    }

    get failedPartitions() {
        return this._services.failedPartitions;
    }

    get reactors() {
        return this._services.reactors;
    }

    get reducers() {
        return this._services.reducers;
    }

    get projections() {
        return this._services.projections;
    }

    get readModels() {
        return this._services.readModels;
    }

    get readModelExplorer() {
        return this._services.readModelExplorer;
    }

    get materializedReadModels() {
        return this._services.materializedReadModels;
    }

    get jobs() {
        return this._services.jobs;
    }

    get webhooks() {
        return this._services.webhooks;
    }

    get eventSeeding() {
        return this._services.eventSeeding;
    }

    get server() {
        return this._services.server;
    }

    get compliance() {
        return this._services.compliance;
    }

    get externalServices() {
        return this._services.externalServices;
    }

    get connections(): ConnectionServiceClient {
        return this._connections;
    }

    async connect(): Promise<void> {
        await this._clientsReady;
        // The bounded compatibility RPC establishes transport readiness and contract support together.
        await this._compatibility.verify();
        this._isConnected = true;
    }

    async resetChannel(): Promise<void> {
        try {
            this._channel?.close();
        } catch {
            // Best-effort shutdown before recreating the channel.
        }

        this._isConnected = false;
        this._clientsReady = this.createClients();
        await this._clientsReady;
    }

    async reconnect(): Promise<void> {
        await this.resetChannel();
        await this.connect();
    }

    disconnect(): void {
        this._isConnected = false;
        this._channel?.close();
    }

    dispose(): void {
        this.disconnect();
    }

    private async createClients(): Promise<void> {
        const channelOptions: ChannelOptions = {};

        if (this._options.maxReceiveMessageSize !== undefined) {
            channelOptions['grpc.max_receive_message_length'] = this._options.maxReceiveMessageSize;
        }

        if (this._options.maxSendMessageSize !== undefined) {
            channelOptions['grpc.max_send_message_length'] = this._options.maxSendMessageSize;
        }

        // Re-resolved (DNS SRV, when applicable) and re-selected (load balancer strategy)
        // on every call, so every connect/reconnect attempt picks up membership and load
        // changes rather than pinning to whatever was selected at startup.
        const candidates = await this._addressResolver.resolve(this._connectionString);
        const selected = await this._loadBalancerStrategy.select(candidates);
        const serverAddress = formatServerAddress(selected);
        const tokenProvider = this.createTokenProvider(selected);
        const credentials = this._options.credentials ?? this._connectionString.createCredentials();

        this._channel = createChannel(serverAddress, credentials, channelOptions);

        const factory = createClientFactory().use(this.createAuthMiddleware(tokenProvider));
        this._connections = factory.create(ConnectionServiceDefinition, this._channel);
        this._compatibility = new CompatibilityPreflight(this._connections, this._options.connectTimeout ?? 10_000);
        const eventSequenceFactory = factory.use(this._compatibility.middleware());
        this._services = {
            eventStores: factory.create(EventStoresDefinition, this._channel),
            namespaces: factory.create(NamespacesDefinition, this._channel),
            recommendations: factory.create(RecommendationsDefinition, this._channel),
            identities: factory.create(IdentitiesDefinition, this._channel),
            eventSequences: eventSequenceFactory.create(EventSequencesDefinition, this._channel),
            eventTypes: factory.create(EventTypesDefinition, this._channel),
            constraints: factory.create(ConstraintsDefinition, this._channel),
            observers: factory.create(ObserversDefinition, this._channel),
            eventStoreSubscriptions: factory.create(EventStoreSubscriptionsDefinition, this._channel),
            failedPartitions: factory.create(FailedPartitionsDefinition, this._channel),
            reactors: factory.create(ReactorsDefinition, this._channel),
            reducers: factory.create(ReducersDefinition, this._channel),
            projections: factory.create(ProjectionsDefinition, this._channel),
            readModels: factory.create(ReadModelsDefinition, this._channel),
            readModelExplorer: factory.create(ReadModelExplorerDefinition, this._channel),
            materializedReadModels: factory.create(MaterializedReadModelsDefinition, this._channel),
            jobs: factory.create(JobsDefinition, this._channel),
            webhooks: factory.create(WebhooksDefinition, this._channel),
            eventSeeding: factory.create(EventSeedingDefinition, this._channel),
            server: factory.create(ServerDefinition, this._channel),
            compliance: factory.create(ComplianceDefinition as any, this._channel) as any,
            externalServices: factory.create(ExternalServicesDefinition, this._channel)
        };
    }

    private createTokenProvider(selected: ChronicleServerAddress): ITokenProvider {
        const hasUsername = !!this._connectionString.username;
        const hasApiKey = !!this._connectionString.apiKey;

        if (hasApiKey) {
            return new NoOpTokenProvider();
        }

        if (hasUsername) {
            return this.createOAuthTokenProvider(selected, this._connectionString.username!, this._connectionString.password!);
        }

        return this.createOAuthTokenProvider(
            selected,
            ChronicleConnectionString.DEVELOPMENT_CLIENT,
            ChronicleConnectionString.DEVELOPMENT_CLIENT_SECRET
        );
    }

    private createOAuthTokenProvider(selected: ChronicleServerAddress, username: string, password: string): ITokenProvider {
        // Chronicle serves authentication on the selected kernel's port unless an explicit
        // authority overrides it. Cache providers by endpoint across channel resets.
        const serverPort = selected.port;
        let authorityHost: string;
        let authorityPort: number;

        if (this._options.authority) {
            const authority = new URL(this._options.authority);
            authorityHost = authority.hostname;
            authorityPort = authority.port ? parseInt(authority.port, 10) : serverPort;
        } else {
            authorityHost = selected.host;
            authorityPort = serverPort;
        }

        const scheme = this._connectionString.disableTls ? 'http' : 'https';
        const endpoint = `${scheme}://${authorityHost.includes(':') && !authorityHost.startsWith('[') ? `[${authorityHost}]` : authorityHost}:${authorityPort}/connect/token`;
        let provider = this._tokenProviders.get(endpoint);
        if (!provider) {
            provider = new OAuthTokenProvider(endpoint, username, password, this._connectionString.skipTlsValidation);
            this._tokenProviders.set(endpoint, provider);
        }
        return provider;
    }

    private createAuthMiddleware(tokenProvider: ITokenProvider): ClientMiddleware {
        const connectionString = this._connectionString;
        const logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/ChronicleConnection' });
        const loggedFailures = new WeakSet<Error>();

        return async function* authMiddleware(call, options) {
            let token: string | undefined;
            let tokenFailure: Error | undefined;
            try {
                token = await acquireTokenUnlessAborted(() => tokenProvider.getAccessToken(), options.signal);
            } catch (error) {
                if (options.signal?.aborted) throw options.signal.reason;
                tokenFailure = error instanceof Error ? error : new Error(String(error));
                if (!loggedFailures.has(tokenFailure)) {
                    loggedFailures.add(tokenFailure);
                    logger.warn('Failed to obtain OAuth2 token; sending RPC without authorization', { error: tokenFailure.message });
                }
            }
            if (!token) tokenFailure ??= tokenProvider.lastTokenFailure;

            if (token) {
                const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
                metadata.set('authorization', `Bearer ${token}`);
                options.metadata = metadata;
            } else if (connectionString.apiKey) {
                const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
                metadata.set('api-key', connectionString.apiKey);
                options.metadata = metadata;
            }

            if (options.signal?.aborted) throw options.signal.reason;
            try {
                return yield* call.next(call.request, options);
            } catch (error) {
                if ((error as { code?: number })?.code !== status.UNAUTHENTICATED) throw error;
                if (token && !call.responseStream && !call.requestStream) {
                    try {
                        const refreshed = await acquireTokenUnlessAborted(() => tokenProvider.refresh(), options.signal);
                        if (refreshed) {
                            const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
                            metadata.set('authorization', `Bearer ${refreshed}`);
                            return yield* call.next(call.request, { ...options, metadata });
                        }
                    } catch (refreshError) {
                        if (options.signal?.aborted) throw options.signal.reason;
                        tokenFailure = refreshError instanceof Error ? refreshError : new Error(String(refreshError));
                    }
                    tokenFailure ??= tokenProvider.lastTokenFailure;
                }
                if (tokenFailure) {
                    const original = error as ClientError;
                    const wrapped = new ClientError(original.path, original.code, `${tokenFailure.message}; Chronicle rejected the unauthenticated RPC`);
                    Object.defineProperty(wrapped, 'cause', { value: original });
                    Object.defineProperty(wrapped, 'tokenFailure', { value: tokenFailure });
                    throw wrapped;
                }
                throw error;
            }
        };
    }
}

/** Stops waiting for a token on cancellation without canceling the shared token request. */
async function acquireTokenUnlessAborted(acquire: () => Promise<string | undefined>, signal?: AbortSignal): Promise<string | undefined> {
    if (signal?.aborted) throw signal.reason;
    if (!signal) return acquire();

    let onAbort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        return await Promise.race([acquire(), aborted]);
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
}
