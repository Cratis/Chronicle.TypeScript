// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
	ChronicleConnection as ContractsChronicleConnection,
	ConnectionServiceDefinition,
	type ChronicleConnectionOptions,
	type ChronicleServices
} from '@cratis/chronicle.contracts';
import type { ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { createClientFactory } from 'nice-grpc';

/**
 * Wraps the contracts connection and allows recreating the underlying channel
 * during reconnect while keeping a stable object reference for consumers.
 */
export class ChronicleConnection implements ChronicleServices {
	private _inner: ContractsChronicleConnection;
	private _authenticatedConnectionService?: ConnectionServiceClient;

	/**
	 * Creates a new {@link ChronicleConnection}.
	 * @param _options - Connection options used to create and recreate the underlying connection.
	 */
	constructor(private readonly _options: ChronicleConnectionOptions) {
		this._inner = this.createInnerConnection();
	}

	/**
	 * Gets the connection string currently used by the inner connection.
	 */
	get connectionString() {
		return this._inner.connectionString;
	}

	/**
	 * Gets whether the current inner connection is connected.
	 */
	get isConnected(): boolean {
		return this._inner.isConnected;
	}

	/**
	 * Event stores service.
	 */
	get eventStores() {
		return this._inner.eventStores;
	}

	/**
	 * Namespaces service.
	 */
	get namespaces() {
		return this._inner.namespaces;
	}

	/**
	 * Recommendations service.
	 */
	get recommendations() {
		return this._inner.recommendations;
	}

	/**
	 * Identities service.
	 */
	get identities() {
		return this._inner.identities;
	}

	/**
	 * Event sequences service.
	 */
	get eventSequences() {
		return this._inner.eventSequences;
	}

	/**
	 * Event types service.
	 */
	get eventTypes() {
		return this._inner.eventTypes;
	}

	/**
	 * Constraints service.
	 */
	get constraints() {
		return this._inner.constraints;
	}

	/**
	 * Observers service.
	 */
	get observers() {
		return this._inner.observers;
	}

	/**
	 * Failed partitions service.
	 */
	get failedPartitions() {
		return this._inner.failedPartitions;
	}

	/**
	 * Reactors service.
	 */
	get reactors() {
		return this._inner.reactors;
	}

	/**
	 * Reducers service.
	 */
	get reducers() {
		return this._inner.reducers;
	}

	/**
	 * Projections service.
	 */
	get projections() {
		return this._inner.projections;
	}

	/**
	 * Read models service.
	 */
	get readModels() {
		return this._inner.readModels;
	}

	/**
	 * Jobs service.
	 */
	get jobs() {
		return this._inner.jobs;
	}

	/**
	 * Event seeding service.
	 */
	get eventSeeding() {
		return this._inner.eventSeeding;
	}

	/**
	 * Server service.
	 */
	get server() {
		return this._inner.server;
	}

	/**
	 * Connection service — used to register this client with the kernel keep-alive mechanism.
	 * Uses an authenticated client (same auth middleware as all other services).
	 */
	get connections(): ConnectionServiceClient {
		if (!this._authenticatedConnectionService) {
			// The inner connectionService lacks auth middleware. Create a properly
			// authenticated client using the same factory pattern as createServices().
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const inner = this._inner as any;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const factory = createClientFactory().use(inner.createAuthMiddleware() as any);
			this._authenticatedConnectionService = factory.create(ConnectionServiceDefinition, inner.channel) as unknown as ConnectionServiceClient;
		}
		return this._authenticatedConnectionService;
	}

	/**
	 * Connects the current inner connection.
	 */
	async connect(): Promise<void> {
		await this._inner.connect();
	}

	/**
	 * Recreates the inner connection (new gRPC channel) without calling connect().
	 * Use this before probing with a real RPC call to ensure a fresh IDLE channel.
	 */
	resetChannel(): void {
		try {
			this._inner.disconnect();
		} catch {
			// Best-effort disconnect before re-creating the channel.
		}
		this._inner = this.createInnerConnection();
		this._authenticatedConnectionService = undefined;
	}

	/**
	 * Recreates and connects the inner connection.
	 */
	async reconnect(): Promise<void> {
		try {
			this._inner.disconnect();
		} catch {
			// Best-effort disconnect before re-creating the channel.
		}

		this._inner = this.createInnerConnection();
		await this._inner.connect();
	}

	/**
	 * Disconnects the current inner connection.
	 */
	disconnect(): void {
		this._inner.disconnect();
	}

	/**
	 * Disposes the current inner connection.
	 */
	dispose(): void {
		this._inner.dispose();
	}

	private createInnerConnection(): ContractsChronicleConnection {
		return new ContractsChronicleConnection(this._options);
	}
}

export type { ChronicleConnectionOptions } from '@cratis/chronicle.contracts';