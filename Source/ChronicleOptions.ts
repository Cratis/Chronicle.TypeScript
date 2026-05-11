// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DefaultClientArtifactsProvider, IClientArtifactsProvider } from './artifacts';
import { ChronicleConnectionString } from './connection';

type ChronicleOptionsConstructorParams = {
    connectionString: ChronicleConnectionString;
    programIdentifier?: string;
    softwareVersion?: string;
    softwareCommit?: string;
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
};

type ChronicleOptionsFactoryParams = {
    clientArtifactsProvider?: IClientArtifactsProvider;
    discoveryPatterns?: string[];
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
     * Set to an empty array to disable automatic file discovery.
     */
    readonly discoveryPatterns: string[];

    private constructor(options: ChronicleOptionsConstructorParams) {
        this.connectionString = options.connectionString;
        this.programIdentifier = options.programIdentifier ?? 'Unknown';
        this.softwareVersion = options.softwareVersion ?? '0.0.0';
        this.softwareCommit = options.softwareCommit ?? 'Unknown';
        this.clientArtifactsProvider = options.clientArtifactsProvider ?? DefaultClientArtifactsProvider.default;
        this.discoveryPatterns = options.discoveryPatterns ?? [
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
        return new ChronicleOptions({ connectionString: parsed, clientArtifactsProvider: options?.clientArtifactsProvider, discoveryPatterns: options?.discoveryPatterns });
    }

    /**
     * Creates a {@link ChronicleOptions} instance for local development.
     * Connects to Chronicle on localhost:35000 using the standard development
     * client credentials and with TLS disabled, matching the default Chronicle
     * development server configuration.
     * @returns A new ChronicleOptions instance for development.
     */
    static development(options?: ChronicleOptionsFactoryParams): ChronicleOptions {
        return ChronicleOptions.fromConnectionString(
            'chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000?disableTls=true',
            options
        );
    }
}
