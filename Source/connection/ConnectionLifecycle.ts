// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

export type ConnectedHandler = () => Promise<void>;
export type DisconnectedHandler = () => Promise<void>;
export type ReconnectRequestedHandler = (reason: string, error: unknown) => void;

/**
 * Represents the lifecycle state for a Chronicle connection.
 */
export class ConnectionLifecycle {
    private readonly _onConnected = new Set<ConnectedHandler>();
    private readonly _onDisconnected = new Set<DisconnectedHandler>();
    private readonly _onFailed = new Set<(error: Error) => Promise<void>>();
    private readonly _onReconnectRequested = new Set<ReconnectRequestedHandler>();
    private _failure?: Error;

    private _isConnected = false;
    private _connectionId: string = Guid.create().toString();

    /**
     * Gets whether the connection is currently connected.
     */
    get isConnected(): boolean {
        return this._isConnected;
    }

    /** Gets the terminal connection failure, if recovery has stopped. */
    get failure(): Error | undefined {
        return this._failure;
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
     * Registers a callback for when something asks the whole client to reconnect.
     * @param handler - Callback to invoke with the reason and the error behind the request.
     * @returns A function that unsubscribes the callback.
     */
    onReconnectRequested(handler: ReconnectRequestedHandler): () => void {
        this._onReconnectRequested.add(handler);
        return () => this._onReconnectRequested.delete(handler);
    }

    /**
     * Asks the whole client to drop its session and reconnect with a new connection id, for instance because
     * the kernel no longer knows the current one.
     *
     * A request about a connection id that has already been replaced is ignored: the session it reports on is
     * gone, and the observer that reported it is opened again by the reconnect that replaced it.
     * @param connectionId - The connection id of the session the request is about.
     * @param reason - Why the reconnect is requested.
     * @param error - The error behind the request.
     * @param onError - Called with the error when a handler throws.
     */
    requestReconnect(connectionId: string, reason: string, error: unknown, onError: (error: unknown) => void): void {
        if (this._failure || connectionId !== this._connectionId) return;
        for (const handler of this._onReconnectRequested) {
            try {
                handler(reason, error);
            } catch (handlerError) {
                onError(handlerError);
            }
        }
    }

    /**
     * Replaces the connection id, so the next session is registered with one the kernel has not seen.
     */
    renewConnectionId(): void {
        this._connectionId = Guid.create().toString();
    }

    /** Registers a callback for a terminal connection failure. */
    onFailed(handler: (error: Error) => Promise<void>): () => void {
        this._onFailed.add(handler);
        return () => this._onFailed.delete(handler);
    }

    /** Stops recovery and notifies observers of the terminal connection failure. */
    async failed(error: Error, onError: (error: unknown) => void): Promise<void> {
        if (this._failure) return;
        this._failure = error;
        this._isConnected = false;
        await Promise.all([...this._onFailed].map(handler => this.invokeHandler(() => handler(error), onError)));
    }

    /**
     * Marks lifecycle as connected and invokes connected handlers.
     */
    async connected(onError: (error: unknown) => void): Promise<void> {
        if (this._failure) return;
        this._isConnected = true;
        await Promise.all([...this._onConnected].map(handler => this.invokeHandler(handler, onError)));
    }

    /**
     * Marks lifecycle as disconnected and invokes disconnected handlers.
     */
    async disconnected(onError: (error: unknown) => void): Promise<void> {
        this._isConnected = false;
        await Promise.all([...this._onDisconnected].map(handler => this.invokeHandler(handler, onError)));
        this.renewConnectionId();
    }

    private async invokeHandler(handler: () => Promise<void>, onError: (error: unknown) => void): Promise<void> {
        try {
            await handler();
        } catch (error) {
            onError(error);
        }
    }
}
