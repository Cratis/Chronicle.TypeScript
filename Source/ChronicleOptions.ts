// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnectionString } from '@cratis/chronicle.contracts';
import { DefaultClientArtifactsProvider, IClientArtifactsProvider } from './TypeDiscovery';

type ChronicleOptionsInput = {
    connectionString: ChronicleConnectionString;
    programIdentifier?: string;
    softwareVersion?: string;
    softwareCommit?: string;
    clientArtifactsProvider?: IClientArtifactsProvider;
};

type ChronicleOptionsCreationInput = {
    clientArtifactsProvider?: IClientArtifactsProvider;
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

    private constructor(options: ChronicleOptionsInput) {
        this.connectionString = options.connectionString;
        this.programIdentifier = options.programIdentifier ?? 'Unknown';
        this.softwareVersion = options.softwareVersion ?? '0.0.0';
        this.softwareCommit = options.softwareCommit ?? 'Unknown';
        this.clientArtifactsProvider = options.clientArtifactsProvider ?? DefaultClientArtifactsProvider.default;
    }

    /**
     * Creates a {@link ChronicleOptions} instance from a connection string.
     * @param connectionString - The connection string to parse and use.
     * @returns A new ChronicleOptions instance.
     */
    static fromConnectionString(
        connectionString: string | ChronicleConnectionString,
        options?: ChronicleOptionsCreationInput
    ): ChronicleOptions {
        const parsed = typeof connectionString === 'string'
            ? new ChronicleConnectionString(connectionString)
            : connectionString;
        return new ChronicleOptions({ connectionString: parsed, clientArtifactsProvider: options?.clientArtifactsProvider });
    }

    /**
     * Creates a {@link ChronicleOptions} instance for local development.
     * Uses the default development connection string pointing to localhost:35000.
     * @returns A new ChronicleOptions instance for development.
     */
    static development(options?: ChronicleOptionsCreationInput): ChronicleOptions {
        return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', options);
    }
}
