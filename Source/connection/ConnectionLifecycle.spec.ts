// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ConnectionLifecycle } from './ConnectionLifecycle';

const ignoreErrors = () => { };

describe('ConnectionLifecycle', () => {
    describe('when connected', () => {
        it('should report being connected', async () => {
            const lifecycle = new ConnectionLifecycle();

            await lifecycle.connected(ignoreErrors);

            expect(lifecycle.isConnected).toBe(true);
        });

        it('should invoke every connected handler', async () => {
            const lifecycle = new ConnectionLifecycle();
            const first = vi.fn().mockResolvedValue(undefined);
            const second = vi.fn().mockResolvedValue(undefined);
            lifecycle.onConnected(first);
            lifecycle.onConnected(second);

            await lifecycle.connected(ignoreErrors);

            expect(first).toHaveBeenCalledOnce();
            expect(second).toHaveBeenCalledOnce();
        });

        it('should isolate a failing handler from the others', async () => {
            const lifecycle = new ConnectionLifecycle();
            const failing = vi.fn().mockRejectedValue(new Error('registration failed'));
            const succeeding = vi.fn().mockResolvedValue(undefined);
            const onError = vi.fn();
            lifecycle.onConnected(failing);
            lifecycle.onConnected(succeeding);

            await lifecycle.connected(onError);

            expect(succeeding).toHaveBeenCalledOnce();
            expect(onError).toHaveBeenCalledOnce();
        });
    });

    describe('when disconnected', () => {
        it('should report not being connected', async () => {
            const lifecycle = new ConnectionLifecycle();
            await lifecycle.connected(ignoreErrors);

            await lifecycle.disconnected(ignoreErrors);

            expect(lifecycle.isConnected).toBe(false);
        });

        it('should rotate the connection id', async () => {
            const lifecycle = new ConnectionLifecycle();
            const before = lifecycle.connectionId;

            await lifecycle.disconnected(ignoreErrors);

            // The kernel keys observer subscriptions by connection id, so reusing an
            // evicted id after a reconnect leaves the client registered as a ghost.
            expect(lifecycle.connectionId).not.toBe(before);
        });

        it('should rotate the connection id only after the handlers have run', async () => {
            const lifecycle = new ConnectionLifecycle();
            const idDuringHandler = { value: '' };
            lifecycle.onDisconnected(async () => {
                idDuringHandler.value = lifecycle.connectionId;
            });
            const before = lifecycle.connectionId;

            await lifecycle.disconnected(ignoreErrors);

            // Handlers tear down subscriptions registered under the *old* id, so they
            // must still see it while they run.
            expect(idDuringHandler.value).toBe(before);
        });

        it('should invoke every disconnected handler', async () => {
            const lifecycle = new ConnectionLifecycle();
            const first = vi.fn().mockResolvedValue(undefined);
            const second = vi.fn().mockResolvedValue(undefined);
            lifecycle.onDisconnected(first);
            lifecycle.onDisconnected(second);

            await lifecycle.disconnected(ignoreErrors);

            expect(first).toHaveBeenCalledOnce();
            expect(second).toHaveBeenCalledOnce();
        });
    });

    describe('when a handler is unsubscribed', () => {
        it('should not invoke it again', async () => {
            const lifecycle = new ConnectionLifecycle();
            const handler = vi.fn().mockResolvedValue(undefined);
            const unsubscribe = lifecycle.onConnected(handler);

            unsubscribe();
            await lifecycle.connected(ignoreErrors);

            expect(handler).not.toHaveBeenCalled();
        });
    });
});
