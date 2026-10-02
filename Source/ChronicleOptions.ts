// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { types } from 'node:util';
import { DefaultClientArtifactsProvider, IClientArtifactsProvider } from './artifacts/index.js';
import { ChronicleConnectionString } from './connection/index.js';
import { WellKnownSinks } from './sinks/index.js';
import type { ReactorResultHandler } from './reactors/ReactorResultHandler.js';
import type { ClientArtifactsActivator } from './artifacts/ClientArtifactsActivator.js';
import type { ReadModelNamingPolicy } from './readModels/ReadModelNamingPolicy.js';
import type { ChronicleTelemetryOptions } from './telemetry/ChronicleTelemetryOptions.js';
import type { IChronicleLogger } from './logging/IChronicleLogger.js';

type ChronicleOptionsConstructorParams = {
    telemetry?: ChronicleTelemetryOptions;
    logger?: IChronicleLogger;
    connectionString: ChronicleConnectionString;
    programIdentifier?: string;
    softwareVersion?: string;
    softwareCommit?: string;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
    artifactActivator?: ClientArtifactsActivator;
    readModelNamingPolicy?: ReadModelNamingPolicy;
};

type ChronicleOptionsFactoryParams = {
    telemetry?: ChronicleTelemetryOptions;
    logger?: IChronicleLogger;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
    artifactActivator?: ClientArtifactsActivator;
    readModelNamingPolicy?: ReadModelNamingPolicy;
};

/**
 * Represents configuration options for the Chronicle client.
 */
export class ChronicleOptions {
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

    /** Optional handler for application-owned reactor returns, installed before observations begin. */
    readonly reactorResultHandler?: ReactorResultHandler;

    /** Optional per-delivery reactor/reducer activator; absent means one instance per observation stream. */
    readonly artifactActivator?: ClientArtifactsActivator;

    /**
     * Optional policy that names the container (collection, table, or file) each read model is stored in.
     * It changes only the container name sent at registration; read model identifiers are unchanged.
     * Absent means the container is named by the read model identifier. Arc's MongoDB integration
     * reads collections through its own naming policy, so supply a policy that yields the same names.
     */
    readonly readModelNamingPolicy?: ReadModelNamingPolicy;

    private constructor(options: ChronicleOptionsConstructorParams) {
        this.connectionString = options.connectionString;
        this.programIdentifier = options.programIdentifier ?? 'Unknown';
        this.softwareVersion = options.softwareVersion ?? '0.0.0';
        this.softwareCommit = options.softwareCommit ?? 'Unknown';
        this.clientArtifactsProvider = options.clientArtifactsProvider ?? DefaultClientArtifactsProvider.default;
        this.discoveryPatterns = options.discoveryPatterns ?? ChronicleOptions.defaultDiscoveryPatterns();
        this.defaultSinkTypeId = options.defaultSinkTypeId ?? WellKnownSinks.MongoDB;
        this.reactorResultHandler = options.reactorResultHandler;
        this.artifactActivator = options.artifactActivator;
        this.readModelNamingPolicy = options.readModelNamingPolicy;
        // JavaScript callers may still supply the removed selector. Convention is already the only mode.
        if ((options.telemetry as { spanNames?: unknown } | undefined)?.spanNames === 'legacy') {
            throw new TypeError("telemetry.spanNames: 'legacy' was removed in this major release. Remove spanNames and migrate to the cratis.chronicle.client.* span names.");
        }
        const policy = options.telemetry?.eventSourceId;
        if (policy !== undefined) {
            if (policy?.mode !== 'raw' && policy?.mode !== 'hmac') {
                throw new TypeError('telemetry.eventSourceId.mode must be raw or hmac.');
            }
            if (policy.mode === 'hmac' && (!types.isUint8Array(policy.key) || policy.key.byteLength === 0)) {
                throw new TypeError('telemetry.eventSourceId.key must be a non-empty Uint8Array for hmac mode.');
            }
        }
        this.telemetry = options.telemetry;
        this.logger = options.logger;
    }

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
        return new ChronicleOptions({
            connectionString: parsed,
            clientArtifactsProvider: options?.clientArtifactsProvider,
            discoveryPatterns: options?.discoveryPatterns,
            defaultSinkTypeId: options?.defaultSinkTypeId,
            reactorResultHandler: options?.reactorResultHandler,
            artifactActivator: options?.artifactActivator,
            readModelNamingPolicy: options?.readModelNamingPolicy,
            telemetry: options?.telemetry,
            logger: options?.logger
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
