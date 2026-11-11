// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as os from 'os';
import { createLogger } from './logging/createLogger.js';
import { setTelemetryAttribute, recordSafeException } from './telemetry/spanAttributes.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { ChronicleOptions } from './ChronicleOptions.js';
import { refuseClientHostedObservers } from './artifacts/refuseClientHostedObservers.js';
import { ClientObserversRequireKeepAlive } from './connection/ClientObserversRequireKeepAlive.js';
import { ChronicleConnection } from './connection/index.js';
import { IncompatibleChronicleServer } from './connection/IncompatibleChronicleServer.js';
import { OAuthTokenHttpError } from './connection/fetchOAuthAccessToken.js';
import { RejectedChronicleCredentials } from './connection/RejectedChronicleCredentials.js';
import { ensureCommandSuccess, ensureQuerySuccess } from './connection/callResults.js';
import { ConnectionLifecycle } from './connection/ConnectionLifecycle.js';
import { clientVersion } from './connection/clientVersion.js';
import { KernelKeepAlive } from './connection/KernelKeepAlive.js';
import { EventStore } from './EventStore.js';
import { EventStoreName } from './EventStoreName.js';
import { EventStoreNamespaceName } from './EventStoreNamespaceName.js';
import { IChronicleClient } from './IChronicleClient.js';
import { IEventStore } from './IEventStore.js';
import { ChronicleConventionMetrics } from './Metrics.js';
import { WellKnownTelemetryNames as names } from './WellKnownTelemetryNames.js';
import { observeOperation } from './telemetry/observeOperation.js';
import { runInBackgroundContext } from './telemetry/runInBackgroundContext.js';
import { TypeDiscoverer } from './types/index.js';
import { takeUnregisteredModelBoundMappings } from './types/modelBoundPropertyMetadata.js';
import { reachableReadModelTypes } from './readModels/rootReadModelTypes.js';

const connectionIndicators = [
    'deadline exceeded',
    'unavailable',
    'connection',
    'connectivity',
    'channel',
    'socket',
    'econnrefused',
    'etimedout'
];

const errorCodeOf = (error: unknown): number | undefined => (error as { code?: number })?.code;

const isTerminalServerError = (error: unknown): error is IncompatibleChronicleServer | RejectedChronicleCredentials =>
    error instanceof IncompatibleChronicleServer || error instanceof RejectedChronicleCredentials;

/** gRPC status codes DEADLINE_EXCEEDED (4), INTERNAL (13) and UNAVAILABLE (14) are worth a reconnect. */
const hasReconnectableStatusCode = (error: unknown): boolean => [4, 13, 14].includes(Number(errorCodeOf(error) ?? -1));

/**
 * Where a {@link ChronicleClient} reads the time and the jitter of its reconnect waits from.
 * @internal Lets specifications make the waits deterministic.
 */
export interface ChronicleClientTiming {
    /** Returns the current time in milliseconds. */
    now: () => number;

    /** Returns a value in [0, 1) choosing where in the upper half of a wait this one lands. */
    nextJitter: () => number;
}

const defaultTiming: ChronicleClientTiming = { now: () => Date.now(), nextJitter: () => Math.random() };

/**
 * Implements {@link IChronicleClient} by managing a gRPC connection to the
 * Chronicle Kernel via {@link ChronicleConnection}.
 *
 * Create a client by providing {@link ChronicleOptions} configured with a connection string:
 *
 * ```typescript
 * const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000'));
 * const store = await client.getEventStore('MyStore');
 * await store.eventLog.append('my-entity-id', new MyEvent('data'));
 * client.dispose();
 * ```
 */
export class ChronicleClient implements IChronicleClient {
    private static readonly _healthCheckIntervalMs = 5000;
    private static readonly _maxBackoffMs = 30_000;

    /** How long a session must stay up before losing it starts the wait between session reconnects over. */
    private static readonly _healthySessionMs = 30_000;

    private readonly _connection: ChronicleConnection;
    private readonly _stores: Map<string, EventStore> = new Map();
    private readonly _lifecycle = new ConnectionLifecycle();

    private readonly _logger: ReturnType<typeof createLogger>;

    private _watchdogHandle?: ReturnType<typeof setInterval>;
    private _connectOperation?: Promise<void>;
    private _reconnectOperation?: Promise<void>;
    private _discoveryOperation?: Promise<void>;
    private _isDisposed = false;
    private _keepAliveAbortController?: AbortController;
    private _healthCheckInFlight = false;
    private _connectionFailure?: Error;
    private _consecutiveCredentialRejections = 0;
    private readonly _disposeController = new AbortController();
    private _recoveringFrom?: string;
    private _sessionLostCount = 0;
    private _sessionEstablishedAt?: number;

    /**
     * Creates a new {@link ChronicleClient} using the provided options.
     * @param options - The options to configure the client, including the connection string.
     * @param _timing - Internal: where the client reads the time and the jitter of its reconnect waits from.
     */
    constructor(readonly options: ChronicleOptions, private readonly _timing: ChronicleClientTiming = defaultTiming) {
        this._logger = createLogger('@cratis/chronicle/ChronicleClient', options.logger);
        // When TLS is disabled, pass pre-built insecure credentials directly.
        // @cratis/chronicle.contracts ≤15.24.3 always composes call credentials with
        // channel credentials, which gRPC forbids for insecure channels. Passing
        // credentials explicitly bypasses that code path. Remove once a fixed version
        // of chronicle.contracts is released.
        const connectionOptions = options.connectionString.disableTls
            ? { connectionString: options.connectionString, credentials: options.connectionString.createCredentials() }
            : { connectionString: options.connectionString };
        this._connection = new ChronicleConnection({
            ...connectionOptions,
            deferClientCreation: options.skipKeepAlive,
            logger: options.logger,
            maxReceiveMessageSize: options.maxReceiveMessageSize ?? undefined,
            maxSendMessageSize: options.maxSendMessageSize ?? undefined
        });

        this._logger.info('Created Chronicle client', {
            serverAddress: `${options.connectionString.serverAddress.host}:${options.connectionString.serverAddress.port}`,
            disableTls: options.connectionString.disableTls
        });

        if (options.discoveryPatterns.length > 0) {
            runInBackgroundContext(() => {
                this._discoveryOperation = TypeDiscoverer.default.discover(options.discoveryPatterns);
                this._discoveryOperation.catch(error => {
                    this._logger.error('Artifact file discovery failed', { error });
                });
            });
        }

        this._lifecycle.onConnected(async () => {
            if (this._stores.size === 0) {
                this._logger.debug('No event stores cached; nothing to register on connected lifecycle callback', {
                    connectionId: this._lifecycle.connectionId
                });
                return;
            }

            this._logger.info('Connection lifecycle connected; registering artifacts for cached event stores', {
                connectionId: this._lifecycle.connectionId,
                eventStoreCount: this._stores.size
            });

            await Promise.all([...this._stores.values()].map(store => this.registerArtifactsForStore(store, 'connected')));
        });

        this._lifecycle.onDisconnected(async () => {
            this._logger.warn('Connection lifecycle disconnected', {
                connectionId: this._lifecycle.connectionId
            });
        });

        // An observation stream the kernel ended because it no longer knows this connection cannot be fixed
        // by opening it again: reconnect the whole client, which gets a new connection id and re-registers.
        // The lifecycle has already dropped reports about a replaced session. A report about the session a running
        // reconnect is replacing joins it; one about the session that reconnect just opened needs a reconnect of its own.
        this._lifecycle.onReconnectRequested((reason, error) => {
            if (this._isDisposed) return;
            const running = this._reconnectOperation;
            const next = running && this._recoveringFrom !== this._lifecycle.connectionId
                ? running.catch(() => undefined).then(() => this._isDisposed ? undefined : this.reconnect(reason, error))
                : this.reconnect(reason, error);
            void next.catch(failure => this.backgroundConnectionFailed(reason, failure));
        });

        if (!options.skipKeepAlive) this.startConnectionWatchdog();
    }

    /** @inheritdoc */
    async getEventStore(name: string | EventStoreName, namespace?: string | EventStoreNamespaceName): Promise<IEventStore> {
        const storeName = typeof name === 'string' ? new EventStoreName(name) : name;
        const namespaceName = this.toNamespaceName(namespace);

        return observeOperation('getEventStore', async span => {
            setTelemetryAttribute(span, 'eventStore', storeName.value);
            setTelemetryAttribute(span, 'namespace', namespaceName.value);
            try {
                const store = await this.withReconnect('get_event_store', () => this.getOrCreateEventStore(storeName, namespaceName));

                ChronicleConventionMetrics.eventStoreRetrievals.add(1, {
                    [names.attributes.eventStore]: storeName.value,
                    [names.attributes.namespace]: namespaceName.value
                });
                span.setStatus({ code: SpanStatusCode.OK });
                return store;
            } catch (error) {
                recordSafeException(span, error);
                this._logger.error('Failed getting event store', {
                    eventStore: storeName.value,
                    namespace: namespaceName.value,
                    error
                });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    private toNamespaceName(namespace: string | EventStoreNamespaceName | undefined): EventStoreNamespaceName {
        if (namespace === undefined) return EventStoreNamespaceName.default;
        return typeof namespace === 'string' ? new EventStoreNamespaceName(namespace) : namespace;
    }

    private async getOrCreateEventStore(storeName: EventStoreName, namespaceName: EventStoreNamespaceName): Promise<EventStore> {
        await this.ensureConnected();

        const key = `${storeName.value}/${namespaceName.value}`;
        const existing = this._stores.get(key);
        if (existing) {
            this._logger.verbose('Returning cached event store', {
                eventStore: storeName.value,
                namespace: namespaceName.value
            });
            return existing;
        }

        this._logger.debug('Ensuring event store exists in kernel', {
            eventStore: storeName.value
        });
        ensureCommandSuccess('ensure event store', await this._connection.eventStores.ensureEventStore({ Name: storeName.value }));

        const created = new EventStore(storeName, namespaceName, this._connection, this._lifecycle, this.options.defaultSinkTypeId, this.options.clientArtifactsProvider, this.options.reactorResultHandler, this.options.artifactActivator, this.options.readModelNamingPolicy, this.options.telemetry, this.options.skipKeepAlive, this.options.defaultGraphSinkTypeId);
        this._stores.set(key, created);

        try {
            await this.registerArtifactsForStore(created, 'new-store');
            return created;
        } catch (error) {
            if (this._stores.get(key) === created) this._stores.delete(key);
            created.disposeObservations();
            throw error;
        }
    }

    /** @inheritdoc */
    async getEventStores(): Promise<EventStoreName[]> {
        return observeOperation('getEventStores', async span => {
            try {
                const response = await this.withReconnect('get_event_stores', async () => {
                    await this.ensureConnected();
                    return this._connection.eventStores.allEventStores({});
                });
                const result = ensureQuerySuccess('get event stores', response).map(eventStore => new EventStoreName(eventStore.Name));
                this._logger.verbose('Retrieved event stores from kernel', {
                    count: result.length
                });
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                recordSafeException(span, error);
                this._logger.error('Failed retrieving event stores', {
                    error
                });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    dispose(): void {
        this._isDisposed = true;
        this._disposeController.abort();
        for (const store of this._stores.values()) store.disposeObservations();

        if (this._watchdogHandle) {
            clearInterval(this._watchdogHandle);
            this._watchdogHandle = undefined;
        }

        if (this._lifecycle.isConnected) {
            void this._lifecycle.disconnected(error => {
                this._logger.error('Disconnected lifecycle callback failed during dispose', {
                    error
                });
            });
        }

        this._keepAliveAbortController?.abort();
        this._keepAliveAbortController = undefined;
        this._connection.disconnect();
        this._logger.info('Disposed Chronicle client');
    }

    private async connectWithRetry(): Promise<void> {
        let attempt = 0;

        while (!this._isDisposed) {
            try {
                // Resolve (DNS SRV, when applicable) and select (load balancer strategy) a
                // server address and rebuild the gRPC channel from scratch on every attempt,
                // including the first — so membership and load changes are picked up. Verify
                // the new channel's descriptor before registration or append can produce effects.
                await this._connection.resetChannel();
                await this._connection.connect();

                this._logger.debug('Connecting to Chronicle kernel', { attempt: attempt + 1 });

                // Probe with a real RPC call. gRPC connects lazily on the first call,
                // so this effectively waits until the channel reaches READY or fails.
                await this._connection.server.getVersionInfo({}, { signal: AbortSignal.timeout(10_000) });

                this._consecutiveCredentialRejections = 0;
                this._logger.info('Connected to Chronicle kernel');
                await this.startKernelKeepAlive();
                this._sessionEstablishedAt = this._timing.now();
                await this._lifecycle.connected(error => {
                    this._logger.error('Connected lifecycle callback failed', {
                        error
                    });
                });
                return;


            } catch (error) {
                const terminal = this.terminalConnectionError(error);
                if (terminal) {
                    this.failConnection(terminal);
                    throw terminal;
                }
                attempt++;
                const delayMs = await this.backOff(attempt, 'Connection attempt failed, retrying', error);
                this._logger.verbose('Backed off before next connection attempt', { attempt, delayMs });
            }
        }

        throw new Error('ChronicleClient was disposed during connection attempt.');
    }

    private async validateClientObservers(): Promise<void> {
        if (!this.options.skipKeepAlive) return;
        await this._discoveryOperation;
        refuseClientHostedObservers(this.options.clientArtifactsProvider);
    }

    private async ensureConnected(): Promise<void> {
        if (this._isDisposed) {
            throw new Error('ChronicleClient is disposed. Create a new client instance before making calls.');
        }

        if (this._connectionFailure) throw this._connectionFailure;

        await this.validateClientObservers();

        // Callers arriving during recovery must share its verdict, not create a competing channel.
        if (this._reconnectOperation) await this._reconnectOperation;

        if (this._lifecycle.isConnected) {
            return;
        }

        if (!this._connectOperation) {
            this._connectOperation = runInBackgroundContext(() => this.connectWithRetry()).finally(() => {
                this._connectOperation = undefined;
            });
        }

        await this._connectOperation;
    }

    private async reconnect(reason: string, error: unknown): Promise<void> {
        if (this._connectionFailure) throw this._connectionFailure;

        if (!this._reconnectOperation) {
            this._reconnectOperation = runInBackgroundContext(() => this.recoverConnection(reason, error)).finally(() => {
                this._reconnectOperation = undefined;
            });
        }

        await this._reconnectOperation;
    }

    private async recoverConnection(reason: string, error: unknown): Promise<void> {
        this._logger.warn('Reconnecting to Chronicle kernel', {
            reason,
            error
        });

        const recoveringFrom = this._lifecycle.connectionId;
        this._recoveringFrom = recoveringFrom;
        if (this._lifecycle.isConnected) {
            await this._lifecycle.disconnected(disconnectError => {
                this._logger.error('Disconnected lifecycle callback failed', {
                    error: disconnectError
                });
            });
        }

        // The kernel has forgotten the session being replaced, so the next one must never reuse its id.
        if (this._lifecycle.connectionId === recoveringFrom) this._lifecycle.renewConnectionId();

        if (ChronicleClient.isSessionLost(reason)) {
            await this.waitBeforeSessionReconnect(error);
            if (this._isDisposed) return;
        }

        await this.reconnectWithRetry();
    }

    private static isSessionLost(reason: string): boolean {
        return reason.endsWith('-session-lost');
    }

    /**
     * Keeps a kernel that accepts connections but keeps losing the session right after from causing a hot loop
     * across the whole fleet: every session lost soon after the last one was established waits longer, with jitter,
     * and the wait starts over once a session has stayed up long enough to count as healthy.
     */
    private async waitBeforeSessionReconnect(error: unknown): Promise<void> {
        const establishedAt = this._sessionEstablishedAt;
        if (establishedAt !== undefined && this._timing.now() - establishedAt >= ChronicleClient._healthySessionMs) {
            this._sessionLostCount = 0;
            return;
        }

        this._sessionLostCount++;
        await this.backOff(this._sessionLostCount, 'Session lost soon after connecting, waiting before reconnecting', error);
    }

    private async reconnectWithRetry(): Promise<void> {
        let attempt = 0;
        while (!this._isDisposed) {
            try {
                await this._connection.resetChannel();
                await this._connection.connect();
                await this._connection.server.getVersionInfo({}, { signal: AbortSignal.timeout(10_000) });
                this._consecutiveCredentialRejections = 0;
                this._logger.info('Reconnected to Chronicle kernel', { attempt: attempt + 1 });
                await this.startKernelKeepAlive();
                this._sessionEstablishedAt = this._timing.now();
                await this._lifecycle.connected(connectedError => {
                    this._logger.error('Connected lifecycle callback failed after reconnect', {
                        error: connectedError
                    });
                });
                return;
            } catch (reconnectError) {
                const terminal = this.terminalConnectionError(reconnectError);
                if (terminal) {
                    this.failConnection(terminal);
                    throw terminal;
                }
                attempt++;
                await this.backOff(attempt, 'Reconnect attempt failed, retrying', reconnectError);
            }
        }
    }

    /**
     * Waits out the exponential backoff for a failed attempt and reports why.
     * The delay is jittered so a fleet of clients that lost the same kernel does
     * not come back in lockstep and knock it over again.
     */
    private async backOff(attempt: number, message: string, error: unknown): Promise<number> {
        const ceiling = Math.min(1000 * Math.pow(2, attempt - 1), ChronicleClient._maxBackoffMs);
        const delayMs = Math.round(ceiling / 2 + this._timing.nextJitter() * (ceiling / 2));

        this._logger.warn(message, {
            attempt,
            delayMs,
            error
        });

        await this.delay(delayMs);
        return delayMs;
    }

    /** Waits for the given time, or until the client is disposed, so a pending wait never outlives the client. */
    private delay(delayMs: number): Promise<void> {
        const signal = this._disposeController.signal;
        if (signal.aborted) return Promise.resolve();
        return new Promise(resolve => {
            const done = () => {
                clearTimeout(timer);
                signal.removeEventListener('abort', done);
                resolve();
            };
            const timer = setTimeout(done, delayMs);
            signal.addEventListener('abort', done, { once: true });
        });
    }

    private async withReconnect<T>(operation: string, action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            const terminal = this.terminalConnectionError(error);
            if (terminal) {
                this.failConnection(terminal);
                throw terminal;
            }
            if (!this.shouldReconnect(error)) throw error;

            await this.reconnect(operation, error);
            try {
                return await action();
            } catch (retryError) {
                const retryTerminal = this.terminalConnectionError(retryError);
                if (retryTerminal) {
                    this.failConnection(retryTerminal);
                    throw retryTerminal;
                }
                throw retryError;
            }
        }
    }

    private terminalConnectionError(error: unknown): Error | undefined {
        if (isTerminalServerError(error)) return error;
        const rejection = (error as { code?: number })?.code === 16 &&
            (this.options.connectionString.apiKey || this.hasOAuthCredentialRejection(error));
        this._consecutiveCredentialRejections = rejection ? this._consecutiveCredentialRejections + 1 : 0;
        if (this._consecutiveCredentialRejections === 3) {
            return new RejectedChronicleCredentials(`Chronicle credentials were rejected: ${this.toErrorMessage(error)}`, { cause: error });
        }
        return undefined;
    }

    private hasOAuthCredentialRejection(error: unknown): boolean {
        const tokenError = (error as { tokenFailure?: Error })?.tokenFailure;
        const httpError = tokenError?.cause;
        return httpError instanceof OAuthTokenHttpError && [400, 401].includes(httpError.statusCode) &&
            ['invalid_client', 'unauthorized_client', 'invalid_grant'].includes(httpError.errorCode ?? '');
    }

    private shouldReconnect(error: unknown): boolean {
        if (error instanceof ClientObserversRequireKeepAlive || isTerminalServerError(error)) return false;
        return this.isRejectedAuthentication(error) ||
            hasReconnectableStatusCode(error) ||
            this.mentionsConnectionProblem(error);
    }

    private isRejectedAuthentication(error: unknown): boolean {
        if (errorCodeOf(error) !== 16) return false;
        return !!this.options.connectionString.apiKey || !!(error as { tokenFailure?: Error })?.tokenFailure;
    }

    private mentionsConnectionProblem(error: unknown): boolean {
        const details = String((error as { details?: string })?.details ?? '');
        const combined = `${details} ${this.toErrorMessage(error)}`.toLowerCase();
        return connectionIndicators.some(indicator => combined.includes(indicator));
    }

    private toErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private startConnectionWatchdog(): void {
        this._watchdogHandle = runInBackgroundContext(() => setInterval(() => {
            void this.runHealthCheck().catch(error => this.backgroundConnectionFailed('watchdog-health-check', error));
        }, ChronicleClient._healthCheckIntervalMs));

        this._watchdogHandle.unref?.();
    }

    private get cannotRunHealthCheck(): boolean {
        return this._isDisposed || !this._lifecycle.isConnected || this._healthCheckInFlight;
    }

    private async runHealthCheck(): Promise<void> {
        // A black-holed connection makes the probe itself hang, so without the
        // in-flight guard every tick would stack another one that never returns.
        if (this.cannotRunHealthCheck) {
            return;
        }

        this._healthCheckInFlight = true;
        try {
            await this._connection.server.getVersionInfo({}, { signal: AbortSignal.timeout(10_000) });
            this._logger.verbose('Connection health check passed');
        } catch (error) {
            await this.reconnect('watchdog-health-check', error);
        } finally {
            this._healthCheckInFlight = false;
        }
    }

    private async startKernelKeepAlive(): Promise<void> {
        if (this.options.skipKeepAlive) return;

        this._keepAliveAbortController?.abort();
        this._keepAliveAbortController = new AbortController();
        const { signal } = this._keepAliveAbortController;

        // Losing the keep-alive means the kernel has stopped counting us as
        // connected, so observers are already being torn down server-side.
        // Reconnecting is the only way back — without this the client sits on a
        // dead session, appends keep working, and reactors never fire again.
        const keepAlive = new KernelKeepAlive(this._connection.connections, (reason, error) => {
            if (this._isDisposed || signal.aborted) {
                return;
            }

            void this.reconnect(reason, error).catch(failure => this.backgroundConnectionFailed(reason, failure));
        }, {}, this.options.logger);

        await keepAlive.start(
            {
                ConnectionId: this._lifecycle.connectionId,
                ClientVersion: clientVersion,
                IsRunningWithDebugger: false,
                ProcessId: process.pid,
                ProcessPath: process.execPath,
                MachineName: os.hostname(),
                ClientType: 'TypeScript'
            },
            signal
        );

        this._logger.info('Client registered with kernel keep-alive mechanism', {
            connectionId: this._lifecycle.connectionId
        });
    }

    private failConnection(error: Error): void {
        this._connectionFailure = error;
        void this._lifecycle.failed(error, failure => {
            this._logger.error('Failed lifecycle callback failed', { error: failure });
        });
        this._keepAliveAbortController?.abort();
        this._connection.disconnect();
        if (this._watchdogHandle) {
            clearInterval(this._watchdogHandle);
            this._watchdogHandle = undefined;
        }
    }

    private backgroundConnectionFailed(reason: string, error: unknown): void {
        this.failConnection(error instanceof Error ? error : new Error(String(error)));
        this._logger.error('Background connection recovery failed; create a new client after correcting the server', {
            reason,
            error
        });
    }

    private async registerArtifactsForStore(store: EventStore, reason: string): Promise<void> {
        this._logger.debug('Registering artifacts for event store', {
            eventStore: store.name.value,
            namespace: store.namespace.value,
            reason
        });

        if (this._discoveryOperation) {
            await this._discoveryOperation;
        }

        const unregisteredMappings = takeUnregisteredModelBoundMappings(reachableReadModelTypes(this.options.clientArtifactsProvider));
        if (unregisteredMappings.length > 0) {
            this._logger.warn(
                `Standard-decorated model-bound properties were not registered: ${unregisteredMappings.join(', ')}. ` +
                'Add a class-level @fromEvent(...), enable discoveryPatterns, or register the class explicitly before getEventStore(...).',
                { eventStore: store.name.value, namespace: store.namespace.value }
            );
        }

        await store.registerArtifacts();

        this._logger.info('Registered artifacts for event store', {
            eventStore: store.name.value,
            namespace: store.namespace.value,
            reason
        });
    }
}
