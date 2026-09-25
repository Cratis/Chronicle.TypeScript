// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DefaultClientArtifactsProvider, IClientArtifactsProvider } from './artifacts/index.js';
import { ChronicleConnectionString } from './connection/index.js';
import { WellKnownSinks } from './sinks/index.js';
import type { ReactorResultHandler } from './reactors/ReactorResultHandler.js';

type ChronicleOptionsConstructorParams = {
    connectionString: ChronicleConnectionString;
    programIdentifier?: string;
    softwareVersion?: string;
    softwareCommit?: string;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
};

type ChronicleOptionsFactoryParams = {
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
    defaultSinkTypeId?: string;
    reactorResultHandler?: ReactorResultHandler;
};

/**
 * Represents configuration options for the Chronicle client.
 */
export class ChronicleOptions {
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

    private constructor(options: ChronicleOptionsConstructorParams) {
        this.connectionString = options.connectionString;
        this.programIdentifier = options.programIdentifier ?? 'Unknown';
        this.softwareVersion = options.softwareVersion ?? '0.0.0';
        this.softwareCommit = options.softwareCommit ?? 'Unknown';
        this.clientArtifactsProvider = options.clientArtifactsProvider ?? DefaultClientArtifactsProvider.default;
        this.discoveryPatterns = options.discoveryPatterns ?? ChronicleOptions.defaultDiscoveryPatterns();
        this.defaultSinkTypeId = options.defaultSinkTypeId ?? WellKnownSinks.MongoDB;
        this.reactorResultHandler = options.reactorResultHandler;
    }

    private static defaultDiscoveryPatterns(): string[] {
        const typescriptEntry = /\.(?:ts|tsx|mts|cts)$/i.test(process.argv[1] ?? '');
        const typescriptLoader = process.execArgv.some(arg => /(?:tsx|ts-node|--experimental-strip-types|--experimental-transform-types)/i.test(arg));
        // process.features.typescript is set on every Node.js 24+ process (type stripping), so it
        // does not mean the program was started from TypeScript; it is deliberately not consulted.
        if (!typescriptEntry && !process.env.VITEST && !typescriptLoader) return [];
        return [
            '**/*.ts',
            '!**/*.d.ts',
            '!**/node_modules',
            '!**/dist',
            '!**/build',
            '!**/.git',
            '!**/.vscode',
            '!**/*.spec.ts',
            '!**/*.test.ts'
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
            reactorResultHandler: options?.reactorResultHandler
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
