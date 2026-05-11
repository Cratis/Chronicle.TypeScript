// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

export type ConnectedHandler = () => Promise<void>;
export type DisconnectedHandler = () => Promise<void>;

/**
 * Represents the lifecycle state for a Chronicle connection.
 */
export class ConnectionLifecycle {
    private readonly _onConnected = new Set<ConnectedHandler>();
    private readonly _onDisconnected = new Set<DisconnectedHandler>();

    private _isConnected = false;
    private _connectionId: string = Guid.create().toString();

    /**
     * Gets whether the connection is currently connected.
     */
    get isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Gets the current connection identifier.
     */
    get connectionId(): string {
        return this._connectionId;
    }

    /**
     * Registers a callback for when the connection is connected.
     * @param handler - Callback to invoke on connect.
     * @returns A function that unsubscribes the callback.
     */
    onConnected(handler: ConnectedHandler): () => void {
        this._onConnected.add(handler);
        return () => this._onConnected.delete(handler);
    }

    /**
     * Registers a callback for when the connection is disconnected.
     * @param handler - Callback to invoke on disconnect.
     * @returns A function that unsubscribes the callback.
     */
    onDisconnected(handler: DisconnectedHandler): () => void {
        this._onDisconnected.add(handler);
        return () => this._onDisconnected.delete(handler);
    }

    /**
     * Marks lifecycle as connected and invokes connected handlers.
     */
    async connected(onError: (error: unknown) => void): Promise<void> {
        this._isConnected = true;
        await Promise.all([...this._onConnected].map(handler => this.invokeHandler(handler, onError)));
    }

    /**
     * Marks lifecycle as disconnected and invokes disconnected handlers.
     */
    async disconnected(onError: (error: unknown) => void): Promise<void> {
        this._isConnected = false;
        await Promise.all([...this._onDisconnected].map(handler => this.invokeHandler(handler, onError)));
        this._connectionId = Guid.create().toString();
    }

    private async invokeHandler(handler: () => Promise<void>, onError: (error: unknown) => void): Promise<void> {
        try {
            await handler();
        } catch (error) {
            onError(error);
        }
    }
}
