// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OAuthTokenResponse } from './fetchOAuthAccessToken';
import { OAuthTokenProvider } from './TokenProvider';

// Long enough to stay outside the 60s refresh margin for the whole spec.
const longLifetime = 3600;
// Short enough to be inside the refresh margin immediately.
const shortLifetime = 30;

const token = (value: string, expiresIn?: number | string): OAuthTokenResponse =>
    ({ access_token: value, ...(expiresIn === undefined ? {} : { expires_in: expiresIn }) });

/**
 * Creates a provider whose token fetches are served from the given script of
 * responses — the last one repeats for any further fetches.
 */
function createProvider(responses: Array<OAuthTokenResponse | Error>) {
    let call = 0;
    const fetchToken = vi.fn(() => {
        const response = responses[Math.min(call++, responses.length - 1)];
        return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    });

    const provider = new OAuthTokenProvider('https://localhost:35000/connect/token', 'client', 'secret', true, fetchToken);
    return { provider, fetchToken };
}

describe('OAuthTokenProvider', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('when requesting the first token', () => {
        it('should fetch it lazily and return it', async () => {
            const { provider, fetchToken } = createProvider([token('token-1', longLifetime)]);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the cached token is fresh', () => {
        it('should serve it without fetching again', async () => {
            const { provider, fetchToken } = createProvider([token('token-1', longLifetime), token('token-2', longLifetime)]);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(await provider.getAccessToken()).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the token response has no expires_in', () => {
        it('should assume the default lifetime and cache the token', async () => {
            const { provider, fetchToken } = createProvider([token('token-1')]);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(await provider.getAccessToken()).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the token response sends expires_in as a string', () => {
        it('should parse it and cache the token', async () => {
            const { provider, fetchToken } = createProvider([token('token-1', '3600')]);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(await provider.getAccessToken()).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the token enters the refresh margin', () => {
        it('should refresh ahead of expiry', async () => {
            const { provider, fetchToken } = createProvider([token('token-1', shortLifetime), token('token-2', shortLifetime)]);

            expect(await provider.getAccessToken()).toBe('token-1');

            // The short lifetime is already inside the margin, so the next request
            // refreshes even though the first token has not expired yet.
            expect(await provider.getAccessToken()).toBe('token-2');
            expect(fetchToken).toHaveBeenCalledTimes(2);
        });
    });

    describe('when a refresh fails while the cached token is still valid', () => {
        it('should keep serving the cached token', async () => {
            const { provider } = createProvider([token('token-1', shortLifetime), new Error('unavailable')]);

            expect(await provider.getAccessToken()).toBe('token-1');

            // Refresh is due (inside the margin) and fails — the token is still valid
            // for another 30s, so it must keep flowing rather than dropping auth.
            expect(await provider.getAccessToken()).toBe('token-1');
        });
    });

    describe('when no token can be fetched', () => {
        it('should return undefined instead of rejecting', async () => {
            const { provider } = createProvider([new Error('unavailable')]);

            // The RPC proceeds and fails with the server's auth rejection — that is
            // the session machinery's problem, not the token provider's.
            expect(await provider.getAccessToken()).toBeUndefined();
        });

        it('should throttle further fetch attempts', async () => {
            const { provider, fetchToken } = createProvider([new Error('unavailable')]);

            expect(await provider.getAccessToken()).toBeUndefined();
            expect(await provider.getAccessToken()).toBeUndefined();

            // The second request arrives well inside the retry delay — one attempt,
            // not one per RPC (the session answers a keepalive every second).
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });

        it('should try again once the retry delay has passed', async () => {
            vi.useFakeTimers();
            const { provider, fetchToken } = createProvider([new Error('unavailable'), token('token-1', longLifetime)]);

            expect(await provider.getAccessToken()).toBeUndefined();
            vi.advanceTimersByTime(5000);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(2);
        });
    });

    describe('when multiple requests race', () => {
        it('should share a single fetch', async () => {
            let resolveFetch!: (response: OAuthTokenResponse) => void;
            const fetchToken = vi.fn(() => new Promise<OAuthTokenResponse>(resolve => {
                resolveFetch = resolve;
            }));
            const provider = new OAuthTokenProvider('https://localhost:35000/connect/token', 'client', 'secret', true, fetchToken);

            const first = provider.getAccessToken();
            const second = provider.getAccessToken();
            resolveFetch(token('token-1', longLifetime));

            expect(await first).toBe('token-1');
            expect(await second).toBe('token-1');
            expect(fetchToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('when a refresh is forced', () => {
        it('should discard the cached token and fetch a new one', async () => {
            const { provider, fetchToken } = createProvider([token('token-1', longLifetime), token('token-2', longLifetime)]);

            expect(await provider.getAccessToken()).toBe('token-1');
            expect(await provider.refresh()).toBe('token-2');
            expect(fetchToken).toHaveBeenCalledTimes(2);
        });
    });
});
