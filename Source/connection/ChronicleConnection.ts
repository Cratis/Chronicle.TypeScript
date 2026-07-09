// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Channel, ChannelCredentials, ChannelOptions } from '@grpc/grpc-js';
import {
    ConnectionServiceDefinition,
    ConstraintsDefinition,
    EventSeedingDefinition,
    EventSequencesDefinition,
    EventStoresDefinition,
    EventTypesDefinition,
    FailedPartitionsDefinition,
    IdentitiesDefinition,
    JobsDefinition,
    MaterializedReadModelsDefinition,
    NamespacesDefinition,
    ObserversDefinition,
    ProjectionsDefinition,
    ReactorsDefinition,
    ReadModelsDefinition,
    RecommendationsDefinition,
    ReducersDefinition,
    ServerDefinition,
    WebhooksDefinition,
    type ConnectionServiceClient
} from '@cratis/chronicle.contracts';
import { ComplianceDefinition } from '../compliance/ComplianceContracts';
import { createChannel, createClientFactory, waitForChannelReady } from 'nice-grpc';
import type { ClientMiddleware } from 'nice-grpc-common';
import { Metadata } from 'nice-grpc-common';
import { EventStoreSubscriptionsDefinition } from '../eventStoreSubscriptions/contracts';
import { AuthenticationMode, ChronicleConnectionString } from './ChronicleConnectionString';
import { ChronicleServices } from './ChronicleServices';
import { ITokenProvider, NoOpTokenProvider, OAuthTokenProvider } from './TokenProvider';

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
    private readonly _connectionString: ChronicleConnectionString;
    private readonly _tokenProvider: ITokenProvider;
    private _isConnected = false;

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

        this._tokenProvider = this.createTokenProvider();
        this.createClients();
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

    get connections(): ConnectionServiceClient {
        return this._connections;
    }

    async connect(): Promise<void> {
        const deadline = new Date(Date.now() + (this._options.connectTimeout ?? 10_000));
        await waitForChannelReady(this._channel, deadline);
        this._isConnected = true;
    }

    resetChannel(): void {
        try {
            this._channel.close();
        } catch {
            // Best-effort shutdown before recreating the channel.
        }

        this._isConnected = false;
        this.createClients();
    }

    async reconnect(): Promise<void> {
        this.resetChannel();
        await this.connect();
    }

    disconnect(): void {
        this._isConnected = false;
        this._channel.close();
    }

    dispose(): void {
        this.disconnect();
    }

    private createClients(): void {
        const channelOptions: ChannelOptions = {};

        if (this._options.maxReceiveMessageSize !== undefined) {
            channelOptions['grpc.max_receive_message_length'] = this._options.maxReceiveMessageSize;
        }

        if (this._options.maxSendMessageSize !== undefined) {
            channelOptions['grpc.max_send_message_length'] = this._options.maxSendMessageSize;
        }

        const serverAddress = `${this._connectionString.serverAddress.host}:${this._connectionString.serverAddress.port}`;
        const credentials = this._options.credentials ?? this._connectionString.createCredentials();

        this._channel = createChannel(serverAddress, credentials, channelOptions);

        const factory = createClientFactory().use(this.createAuthMiddleware());
        this._services = {
            eventStores: factory.create(EventStoresDefinition, this._channel),
            namespaces: factory.create(NamespacesDefinition, this._channel),
            recommendations: factory.create(RecommendationsDefinition, this._channel),
            identities: factory.create(IdentitiesDefinition, this._channel),
            eventSequences: factory.create(EventSequencesDefinition, this._channel),
            eventTypes: factory.create(EventTypesDefinition, this._channel),
            constraints: factory.create(ConstraintsDefinition, this._channel),
            observers: factory.create(ObserversDefinition, this._channel),
            eventStoreSubscriptions: factory.create(EventStoreSubscriptionsDefinition, this._channel),
            failedPartitions: factory.create(FailedPartitionsDefinition, this._channel),
            reactors: factory.create(ReactorsDefinition, this._channel),
            reducers: factory.create(ReducersDefinition, this._channel),
            projections: factory.create(ProjectionsDefinition, this._channel),
            readModels: factory.create(ReadModelsDefinition, this._channel),
            materializedReadModels: factory.create(MaterializedReadModelsDefinition, this._channel),
            jobs: factory.create(JobsDefinition, this._channel),
            webhooks: factory.create(WebhooksDefinition, this._channel),
            eventSeeding: factory.create(EventSeedingDefinition, this._channel),
            server: factory.create(ServerDefinition, this._channel),
            compliance: factory.create(ComplianceDefinition as any, this._channel) as any
        };
        this._connections = factory.create(ConnectionServiceDefinition, this._channel);
    }

    private createTokenProvider(): ITokenProvider {
        const hasUsername = !!this._connectionString.username;
        const hasPassword = !!this._connectionString.password;
        const hasApiKey = !!this._connectionString.apiKey;

        if (hasApiKey) {
            return new NoOpTokenProvider();
        }

        if (hasUsername !== hasPassword) {
            throw new Error('Connection string must contain both username and password, or neither');
        }

        if (hasUsername && hasPassword) {
            return this.createOAuthTokenProvider(this._connectionString.username!, this._connectionString.password!);
        }

        return this.createOAuthTokenProvider(
            ChronicleConnectionString.DEVELOPMENT_CLIENT,
            ChronicleConnectionString.DEVELOPMENT_CLIENT_SECRET
        );
    }

    private createOAuthTokenProvider(username: string, password: string): ITokenProvider {
        // Chronicle serves the authentication endpoint on the same port as the rest of the
        // Kernel, so the authority defaults to the connection string's server address.
        const serverPort = this._connectionString.serverAddress.port;
        let authorityHost: string;
        let authorityPort: number;

        if (this._options.authority) {
            const authority = new URL(this._options.authority);
            authorityHost = authority.hostname;
            authorityPort = authority.port ? parseInt(authority.port, 10) : serverPort;
        } else {
            authorityHost = this._connectionString.serverAddress.host;
            authorityPort = serverPort;
        }

        const scheme = this._connectionString.disableTls ? 'http' : 'https';
        return new OAuthTokenProvider(
            `${scheme}://${authorityHost}:${authorityPort}/connect/token`,
            username,
            password
        );
    }

    private createAuthMiddleware(): ClientMiddleware {
        const tokenProvider = this._tokenProvider;
        const connectionString = this._connectionString;

        return async function* authMiddleware(call, options) {
            const token = await tokenProvider.getAccessToken();

            if (token) {
                const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
                metadata.set('authorization', `Bearer ${token}`);
                options.metadata = metadata;
            } else if (connectionString.authenticationMode === AuthenticationMode.ApiKey && connectionString.apiKey) {
                const metadata = options.metadata ? Metadata(options.metadata) : Metadata();
                metadata.set('api-key', connectionString.apiKey);
                options.metadata = metadata;
            }

            return yield* call.next(call.request, options);
        };
    }
}
