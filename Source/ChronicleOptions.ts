// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { types } from 'node:util';
import { DefaultClientArtifactsProvider, IClientArtifactsProvider } from './artifacts/index.js';
import { ChronicleConnectionString } from './connection/index.js';
import { WellKnownSinks } from './sinks/index.js';
import type { ReactorResultHandler } from './reactors/ReactorResultHandler.js';
import type { EventEnrichmentProvider } from './eventSequences/EventEnrichmentProvider.js';
import type { ClientArtifactsActivator } from './artifacts/ClientArtifactsActivator.js';
import type { ReadModelNamingPolicy } from './readModels/ReadModelNamingPolicy.js';
import type { ChronicleTelemetryOptions } from './telemetry/ChronicleTelemetryOptions.js';
import type { IChronicleLogger } from './logging/IChronicleLogger.js';

type ChronicleOptionsConstructorParams = {
    eventEnrichmentProviders?: readonly EventEnrichmentProvider[];
    telemetry?: ChronicleTelemetryOptions;
    logger?: IChronicleLogger;
    connectionString: ChronicleConnectionString;
    skipKeepAlive?: boolean;
    programIdentifier?: string;
    softwareVersion?: string;
    softwareCommit?: string;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    defaultGraphSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
    artifactActivator?: ClientArtifactsActivator;
    readModelNamingPolicy?: ReadModelNamingPolicy;
    maxReceiveMessageSize?: number | null;
    maxSendMessageSize?: number | null;
    connectTimeout?: number;
};

type ChronicleOptionsFactoryParams = {
    eventEnrichmentProviders?: readonly EventEnrichmentProvider[];
    skipKeepAlive?: boolean;
    telemetry?: ChronicleTelemetryOptions;
    logger?: IChronicleLogger;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    defaultGraphSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
    artifactActivator?: ClientArtifactsActivator;
    readModelNamingPolicy?: ReadModelNamingPolicy;
    maxReceiveMessageSize?: number | null;
    maxSendMessageSize?: number | null;
    connectTimeout?: number;
};

/**
 * Represents configuration options for the Chronicle client.
 */
export class ChronicleOptions {
    /** Skip the keep-alive stream and health watchdog for short-lived processes. Either input can enable this. */
    readonly skipKeepAlive: boolean;

    /** Per-client telemetry privacy settings. Event source identifiers are omitted by default. */
    readonly telemetry?: ChronicleTelemetryOptions;

    /** Application diagnostic sink. Absent uses the OpenTelemetry diag compatibility adapter. */
    readonly logger?: IChronicleLogger;

    /**
     * The connection string used to connect to the Chronicle Kernel.
     */
    readonly connectionString: ChronicleConnectionString;

    /**
     * The program identifier used in causation metadata.
     */
    readonly programIdentifier: string;

    /**
     * The software version used in causation metadata.
     */
    readonly softwareVersion: string;

    /**
     * The software commit hash used in causation metadata.
     */
    readonly softwareCommit: string;

    /**
     * The provider used for client artifact discovery.
     */
    readonly clientArtifactsProvider: IClientArtifactsProvider;

    /**
     * Glob patterns used to discover artifact files at startup.
     * Patterns prefixed with '!' are treated as exclusions.
     * By default, TypeScript entry files (.ts, .tsx, .mts, .cts) or TypeScript runtimes scan TypeScript sources;
     * compiled JavaScript entry files do not scan (imported modules register their artifacts).
     * Explicit patterns are used regardless of the entry file. Set to an empty array to
     * disable automatic file discovery.
     */
    readonly discoveryPatterns: string[];

    /**
     * The default sink type identifier used when registering projections, reducers and read models.
     * Defaults to {@link WellKnownSinks.MongoDB}. Set to {@link WellKnownSinks.SQL} to persist read
     * models into a SQL database.
     */
    readonly defaultSinkTypeId: string;

    /**
     * The sink type identifier used when registering property graphs, which are stored by a graph sink and not by the
     * sink of document read models. Defaults to {@link WellKnownSinks.Neo4j}. Set to {@link WellKnownSinks.InMemoryGraph}
     * to keep the graph in the kernel's memory.
     */
    readonly defaultGraphSinkTypeId: string;

    /** Optional handler for application-owned reactor returns, installed before observations begin. */
    readonly reactorResultHandler?: ReactorResultHandler;

    /** Ordered post-serialization providers for single and batch appends on every event store and sequence. */
    readonly eventEnrichmentProviders: readonly EventEnrichmentProvider[];

    /** Optional per-delivery reactor/reducer activator; absent means one instance per observation stream. */
    readonly artifactActivator?: ClientArtifactsActivator;

    /**
     * Optional policy that names the container (collection, table, or file) each read model is stored in.
     * It changes only the container name sent at registration; read model identifiers are unchanged.
     * Absent means the container is named by the read model identifier. Arc's MongoDB integration
     * reads collections through its own naming policy, so supply a policy that yields the same names.
     */
    readonly readModelNamingPolicy?: ReadModelNamingPolicy;

    /**
     * The largest gRPC message, in bytes, the client accepts from the kernel. Defaults to 100 MB, matching the
     * other Chronicle clients. `null` leaves it at gRPC's own default of 4 MB, which is not recommended.
     */
    readonly maxReceiveMessageSize: number | null;

    /**
     * The largest gRPC message, in bytes, the client sends to the kernel. Defaults to 100 MB, matching the
     * other Chronicle clients. `null` leaves it at gRPC's own default.
     */
    readonly maxSendMessageSize: number | null;

    /**
     * How long, in milliseconds, the client waits for the kernel to answer the compatibility check on each new
     * connection. Defaults to 10 seconds. A kernel that does not answer in time fails the connection attempt,
     * which is retried; the check itself is never skipped by a timeout.
     */
    readonly connectTimeout: number;

    private constructor(options: ChronicleOptionsConstructorParams) {
        this.connectionString = options.connectionString;
        this.skipKeepAlive = options.skipKeepAlive === true;
        this.programIdentifier = options.programIdentifier ?? 'Unknown';
        this.softwareVersion = options.softwareVersion ?? '0.0.0';
        this.softwareCommit = options.softwareCommit ?? 'Unknown';
        this.clientArtifactsProvider = options.clientArtifactsProvider ?? DefaultClientArtifactsProvider.default;
        this.discoveryPatterns = options.discoveryPatterns ?? ChronicleOptions.defaultDiscoveryPatterns();
        this.defaultSinkTypeId = options.defaultSinkTypeId ?? WellKnownSinks.MongoDB;
        this.defaultGraphSinkTypeId = options.defaultGraphSinkTypeId ?? WellKnownSinks.Neo4j;
        this.reactorResultHandler = options.reactorResultHandler;
        this.eventEnrichmentProviders = [...(options.eventEnrichmentProviders ?? [])];
        this.artifactActivator = options.artifactActivator;
        this.readModelNamingPolicy = options.readModelNamingPolicy;
        this.maxReceiveMessageSize = options.maxReceiveMessageSize === undefined ? ChronicleOptions.defaultMaxMessageSize : options.maxReceiveMessageSize;
        this.maxSendMessageSize = options.maxSendMessageSize === undefined ? ChronicleOptions.defaultMaxMessageSize : options.maxSendMessageSize;
        this.connectTimeout = ChronicleOptions.validConnectTimeout(options.connectTimeout ?? ChronicleOptions.defaultConnectTimeout);
        ChronicleOptions.validateTelemetry(options.telemetry);
        this.telemetry = options.telemetry;
        this.logger = options.logger;
    }

    private static validConnectTimeout(connectTimeout: number): number {
        // AbortSignal.timeout accepts only whole milliseconds that fit an unsigned 32-bit integer.
        if (!Number.isInteger(connectTimeout) || connectTimeout <= 0 || connectTimeout > ChronicleOptions.maxConnectTimeout) {
            throw new TypeError(`connectTimeout must be a whole number of milliseconds between 1 and ${ChronicleOptions.maxConnectTimeout}.`);
        }
        return connectTimeout;
    }

    private static validateTelemetry(telemetry?: ChronicleTelemetryOptions): void {
        ChronicleOptions.validateSpanNames(telemetry?.spanNames);
        ChronicleOptions.validateEventSourceIdPolicy(telemetry?.eventSourceId);
    }

    private static validateSpanNames(spanNames?: string): void {
        if (spanNames !== undefined && !ChronicleOptions._spanNames.has(spanNames)) {
            throw new TypeError('telemetry.spanNames must be legacy or convention.');
        }
    }

    private static validateEventSourceIdPolicy(policy: ChronicleTelemetryOptions['eventSourceId']): void {
        if (policy === undefined) return;
        if (!ChronicleOptions._eventSourceIdModes.has(policy?.mode)) {
            throw new TypeError('telemetry.eventSourceId.mode must be raw or hmac.');
        }
        if (policy.mode === 'hmac' && !ChronicleOptions.isNonEmptyKey(policy.key)) {
            throw new TypeError('telemetry.eventSourceId.key must be a non-empty Uint8Array for hmac mode.');
        }
    }

    private static readonly _spanNames: ReadonlySet<unknown> = new Set(['legacy', 'convention']);
    private static readonly _eventSourceIdModes: ReadonlySet<unknown> = new Set(['raw', 'hmac']);

    private static isNonEmptyKey(key: unknown): boolean {
        return types.isUint8Array(key) && key.byteLength > 0;
    }

    /** The default maximum gRPC message size in bytes: 100 MB. */
    static readonly defaultMaxMessageSize = 100 * 1024 * 1024;

    /** The default time, in milliseconds, the client waits for the kernel's compatibility check: 10 seconds. */
    static readonly defaultConnectTimeout = 10_000;

    /** The longest connect timeout, in milliseconds, the client accepts: the largest unsigned 32-bit integer. */
    static readonly maxConnectTimeout = 4_294_967_295;

    private static defaultDiscoveryPatterns(): string[] {
        const typescriptEntry = /\.(?:ts|tsx|mts|cts)$/i.test(process.argv[1] ?? '');
        const typescriptLoader = process.execArgv.some(arg => /(?:tsx|ts-node|--experimental-strip-types|--experimental-transform-types)/i.test(arg));
        // process.features.typescript is set on every Node.js 24+ process (type stripping), so it
        // does not mean the program was started from TypeScript; it is deliberately not consulted.
        if (!typescriptEntry && !process.env.VITEST && !typescriptLoader) return [];
        return [
            '**/*.ts',
            '**/*.tsx',
            '!**/*.d.ts',
            '!**/node_modules',
            '!**/dist',
            '!**/build',
            '!**/.git',
            '!**/.vscode',
            '!**/*.spec.ts',
            '!**/*.test.ts',
            '!**/*.spec.tsx',
            '!**/*.test.tsx'
        ];
    }

    private static shouldSkipKeepAlive(connectionString: ChronicleConnectionString, options?: ChronicleOptionsFactoryParams): boolean {
        return options?.skipKeepAlive === true || connectionString.skipKeepAlive;
    }

    /**
     * Creates a {@link ChronicleOptions} instance from a connection string.
     * @param connectionString - The connection string to parse and use.
     * @returns A new ChronicleOptions instance.
     */
    static fromConnectionString(
        connectionString: string | ChronicleConnectionString,
        options?: ChronicleOptionsFactoryParams
    ): ChronicleOptions {
        const parsed = typeof connectionString === 'string'
            ? new ChronicleConnectionString(connectionString)
            : connectionString;
        const factoryOptions: ChronicleOptionsFactoryParams = options ?? {};
        return new ChronicleOptions({
            connectionString: parsed,
            skipKeepAlive: ChronicleOptions.shouldSkipKeepAlive(parsed, options),
            clientArtifactsProvider: factoryOptions.clientArtifactsProvider,
            discoveryPatterns: factoryOptions.discoveryPatterns,
            defaultSinkTypeId: factoryOptions.defaultSinkTypeId,
            defaultGraphSinkTypeId: factoryOptions.defaultGraphSinkTypeId,
            reactorResultHandler: factoryOptions.reactorResultHandler,
            eventEnrichmentProviders: factoryOptions.eventEnrichmentProviders,
            artifactActivator: factoryOptions.artifactActivator,
            readModelNamingPolicy: factoryOptions.readModelNamingPolicy,
            maxReceiveMessageSize: factoryOptions.maxReceiveMessageSize,
            maxSendMessageSize: factoryOptions.maxSendMessageSize,
            connectTimeout: factoryOptions.connectTimeout,
            telemetry: factoryOptions.telemetry,
            logger: factoryOptions.logger
        });
    }

    /**
     * Creates a {@link ChronicleOptions} instance for local development.
     * Connects to Chronicle on localhost:35000 using the standard development
     * client credentials, matching the default Chronicle development server
     * configuration. The Chronicle server requires TLS on its single port, so
     * this connects over TLS against the server's self-signed development
     * certificate.
     * @returns A new ChronicleOptions instance for development.
     */
    static development(options?: ChronicleOptionsFactoryParams): ChronicleOptions {
        return ChronicleOptions.fromConnectionString(ChronicleConnectionString.Development, options);
    }
}
