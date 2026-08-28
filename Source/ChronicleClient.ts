// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as os from 'os';
import { diag } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { ChronicleOptions } from './ChronicleOptions';
import { ChronicleConnection } from './connection';
import { ensureCommandSuccess, ensureQuerySuccess, firstQueryResult } from './connection/callResults';
import { ConnectionLifecycle } from './connection/ConnectionLifecycle';
import { KernelKeepAlive } from './connection/KernelKeepAlive';
import { EventStore } from './EventStore';
import { EventStoreName } from './EventStoreName';
import { EventStoreNamespaceName } from './EventStoreNamespaceName';
import { IChronicleClient } from './IChronicleClient';
import { IEventStore } from './IEventStore';
import { ChronicleMetrics } from './Metrics';
import { ChronicleTracer } from './Tracing';
import { TypeDiscoverer } from './types';

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

    private readonly _connection: ChronicleConnection;
    private readonly _stores: Map<string, EventStore> = new Map();
    private readonly _lifecycle = new ConnectionLifecycle();

    private readonly _logger = diag.createComponentLogger({
        namespace: '@cratis/chronicle/ChronicleClient'
    });

    private _watchdogHandle?: ReturnType<typeof setInterval>;
    private _connectOperation?: Promise<void>;
    private _reconnectOperation?: Promise<void>;
    private _discoveryOperation?: Promise<void>;
    private _isDisposed = false;
    private _keepAliveAbortController?: AbortController;
    private _healthCheckInFlight = false;

    /**
     * Creates a new {@link ChronicleClient} using the provided options.
     * @param options - The options to configure the client, including the connection string.
     */
    constructor(readonly options: ChronicleOptions) {
        // When TLS is disabled, pass pre-built insecure credentials directly.
        // @cratis/chronicle.contracts ≤15.24.3 always composes call credentials with
        // channel credentials, which gRPC forbids for insecure channels. Passing
        // credentials explicitly bypasses that code path. Remove once a fixed version
        // of chronicle.contracts is released.
        const connectionOptions = options.connectionString.disableTls
            ? { connectionString: options.connectionString, credentials: options.connectionString.createCredentials() }
            : { connectionString: options.connectionString };
        this._connection = new ChronicleConnection(connectionOptions);

        this._logger.info('Created Chronicle client', {
            serverAddress: `${options.connectionString.serverAddress.host}:${options.connectionString.serverAddress.port}`,
            disableTls: options.connectionString.disableTls
        });

        if (options.discoveryPatterns.length > 0) {
            this._discoveryOperation = TypeDiscoverer.default.discover(options.discoveryPatterns);
            this._discoveryOperation.catch(error => {
                this._logger.error('Artifact file discovery failed', { error: String(error) });
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

        this.startConnectionWatchdog();
    }

    /** @inheritdoc */
    async getEventStore(name: string | EventStoreName, namespace?: string | EventStoreNamespaceName): Promise<IEventStore> {
        const storeName = typeof name === 'string' ? new EventStoreName(name) : name;
        const namespaceName = namespace === undefined
            ? EventStoreNamespaceName.default
            : typeof namespace === 'string'
                ? new EventStoreNamespaceName(namespace)
                : namespace;

        return ChronicleTracer.startActiveSpan('chronicle.client.get_event_store', async span => {
            span.setAttribute('chronicle.event_store', storeName.value);
            span.setAttribute('chronicle.namespace', namespaceName.value);
            try {
                const store = await this.withReconnect('get_event_store', async () => {
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

                    const created = new EventStore(storeName, namespaceName, this._connection, this._lifecycle, this.options.defaultSinkTypeId);
                    this._stores.set(key, created);

                    await this.registerArtifactsForStore(created, 'new-store');
                    return created;
                });

                ChronicleMetrics.eventStoreRetrievals.add(1, {
                    'chronicle.event_store': storeName.value,
                    'chronicle.namespace': namespaceName.value
                });
                span.setStatus({ code: SpanStatusCode.OK });
                return store;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                this._logger.error('Failed getting event store', {
                    eventStore: storeName.value,
                    namespace: namespaceName.value,
                    error: this.toErrorMessage(error)
                });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getEventStores(): Promise<EventStoreName[]> {
        return ChronicleTracer.startActiveSpan('chronicle.client.get_event_stores', async span => {
            try {
                const response = await this.withReconnect('get_event_stores', async () => {
                    await this.ensureConnected();
                    return firstQueryResult('get event stores', this._connection.eventStores.allEventStores({}));
                });
                const result = ensureQuerySuccess('get event stores', response).map((name: string) => new EventStoreName(name));
                this._logger.verbose('Retrieved event stores from kernel', {
                    count: result.length
                });
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                this._logger.error('Failed retrieving event stores', {
                    error: this.toErrorMessage(error)
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

        if (this._watchdogHandle) {
            clearInterval(this._watchdogHandle);
            this._watchdogHandle = undefined;
        }

        if (this._lifecycle.isConnected) {
            void this._lifecycle.disconnected(error => {
                this._logger.error('Disconnected lifecycle callback failed during dispose', {
                    error: this.toErrorMessage(error)
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
                // including the first — not just once at startup — so membership and load
                // changes are always picked up. This also guarantees a fresh IDLE channel: a
                // failed probe can leave a channel in TRANSIENT_FAILURE, which gRPC won't
                // recover from without a new channel. The contracts connect() is bypassed
                // here — it uses watchConnectivityState and rejects as soon as the state
                // changes to CONNECTING (not READY), making it unreliable for initial
                // connection establishment.
                await this._connection.resetChannel();

                this._logger.debug('Connecting to Chronicle kernel', { attempt: attempt + 1 });

                // Probe with a real RPC call. gRPC connects lazily on the first call,
                // so this effectively waits until the channel reaches READY or fails.
                await this._connection.server.getVersionInfo({}, { signal: AbortSignal.timeout(10_000) });

                this._logger.info('Connected to Chronicle kernel');
                await this.startKernelKeepAlive();
                await this._lifecycle.connected(error => {
                    this._logger.error('Connected lifecycle callback failed', {
                        error: this.toErrorMessage(error)
                    });
                });
                return;


            } catch (error) {
                attempt++;
                const delayMs = await this.backOff(attempt, 'Connection attempt failed, retrying', error);
                this._logger.verbose('Backed off before next connection attempt', { attempt, delayMs });
            }
        }

        throw new Error('ChronicleClient was disposed during connection attempt.');
    }

    private async ensureConnected(): Promise<void> {
        if (this._isDisposed) {
            throw new Error('ChronicleClient is disposed. Create a new client instance before making calls.');
        }

        if (this._lifecycle.isConnected) {
            return;
        }

        if (!this._connectOperation) {
            this._connectOperation = this.connectWithRetry().finally(() => {
                this._connectOperation = undefined;
            });
        }

        await this._connectOperation;
    }

    private async reconnect(reason: string, error: unknown): Promise<void> {
        if (!this._reconnectOperation) {
            this._reconnectOperation = (async () => {
                this._logger.warn('Reconnecting to Chronicle kernel', {
                    reason,
                    error: this.toErrorMessage(error)
                });

                if (this._lifecycle.isConnected) {
                    await this._lifecycle.disconnected(disconnectError => {
                        this._logger.error('Disconnected lifecycle callback failed', {
                            error: this.toErrorMessage(disconnectError)
                        });
                    });
                }

                let attempt = 0;
                while (!this._isDisposed) {
                    try {
                        await this._connection.resetChannel();
                        await this._connection.server.getVersionInfo({}, { signal: AbortSignal.timeout(10_000) });
                        this._logger.info('Reconnected to Chronicle kernel', { attempt: attempt + 1 });
                        await this.startKernelKeepAlive();
                        await this._lifecycle.connected(connectedError => {
                            this._logger.error('Connected lifecycle callback failed after reconnect', {
                                error: this.toErrorMessage(connectedError)
                            });
                        });
                        return;
                    } catch (reconnectError) {
                        attempt++;
                        await this.backOff(attempt, 'Reconnect attempt failed, retrying', reconnectError);
                    }
                }
            })().finally(() => {
                this._reconnectOperation = undefined;
            });
        }

        await this._reconnectOperation;
    }

    /**
     * Waits out the exponential backoff for a failed attempt and reports why.
     * The delay is jittered so a fleet of clients that lost the same kernel does
     * not come back in lockstep and knock it over again.
     */
    private async backOff(attempt: number, message: string, error: unknown): Promise<number> {
        const ceiling = Math.min(1000 * Math.pow(2, attempt - 1), ChronicleClient._maxBackoffMs);
        const delayMs = Math.round(ceiling / 2 + Math.random() * (ceiling / 2));

        this._logger.warn(message, {
            attempt,
            delayMs,
            error: this.toErrorMessage(error)
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
        return delayMs;
    }

    private async withReconnect<T>(operation: string, action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            if (!this.shouldReconnect(error)) {
                throw error;
            }

            await this.reconnect(operation, error);
            return action();
        }
    }

    private shouldReconnect(error: unknown): boolean {
        const code = Number((error as { code?: number })?.code ?? -1);
        const details = String((error as { details?: string })?.details ?? '');
        const message = this.toErrorMessage(error);

        if (code === 4 || code === 13 || code === 14) {
            return true;
        }

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

        const combined = `${details} ${message}`.toLowerCase();
        return connectionIndicators.some(indicator => combined.includes(indicator));
    }

    private toErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private startConnectionWatchdog(): void {
        this._watchdogHandle = setInterval(() => {
            void this.runHealthCheck();
        }, ChronicleClient._healthCheckIntervalMs);

        this._watchdogHandle.unref?.();
    }

    private async runHealthCheck(): Promise<void> {
        // A black-holed connection makes the probe itself hang, so without the
        // in-flight guard every tick would stack another one that never returns.
        if (this._isDisposed || !this._lifecycle.isConnected || this._healthCheckInFlight) {
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

            void this.reconnect(reason, error);
        });

        await keepAlive.start(
            {
                ConnectionId: this._lifecycle.connectionId,
                // TODO: Not derived from this package's own version anywhere yet; kept as
                // the pre-existing hardcoded placeholder until such a mechanism exists.
                ClientVersion: '1.0.0',
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

    private async registerArtifactsForStore(store: EventStore, reason: string): Promise<void> {
        this._logger.debug('Registering artifacts for event store', {
            eventStore: store.name.value,
            namespace: store.namespace.value,
            reason
        });

        if (this._discoveryOperation) {
            await this._discoveryOperation;
        }

        await store.registerArtifacts();

        this._logger.info('Registered artifacts for event store', {
            eventStore: store.name.value,
            namespace: store.namespace.value,
            reason
        });
    }
}
