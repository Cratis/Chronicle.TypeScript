// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { fetchOAuthAccessToken, type OAuthTokenResponse } from './fetchOAuthAccessToken';

// Refresh once the token has less than this long left before it expires.
const TOKEN_REFRESH_MARGIN_MS = 60_000;
// Assumed lifetime when the token response carries no usable expires_in.
const DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;
// Minimum pause between failed fetch attempts, so an auth outage does not turn
// every RPC into a token request.
const FAILED_FETCH_RETRY_DELAY_MS = 5_000;

/**
 * Interface for providing authentication tokens.
 */
export interface ITokenProvider {
    /**
     * Gets the current access token.
     *
     * Never rejects — when no token can be obtained the result is undefined, the RPC
     * proceeds without authorization and fails with the server's rejection, which the
     * session machinery recovers from.
     * @returns Promise resolving to the access token or undefined if not available.
     */
    getAccessToken(): Promise<string | undefined>;

    /**
     * Refreshes the access token by clearing cached tokens and obtaining a new one.
     * @returns Promise resolving to the new access token or undefined if not available.
     */
    refresh(): Promise<string | undefined>;
}

/**
 * No-op token provider for when authentication is not required.
 */
export class NoOpTokenProvider implements ITokenProvider {
    async getAccessToken(): Promise<string | undefined> {
        return undefined;
    }

    async refresh(): Promise<string | undefined> {
        return undefined;
    }
}

/**
 * OAuth token provider using the client credentials flow.
 *
 * Owns the access token so it can be attached to every RPC individually instead of
 * being baked into the channel at connect time: the token is fetched lazily on first
 * use, cached, and refreshed once it enters the refresh margin ahead of expiry, so
 * token expiry never invalidates the channel. A failed refresh falls back to the
 * cached token while it is still actually valid — only the refresh margin has been
 * crossed, not the expiry — and further attempts are throttled so an unreachable
 * auth endpoint does not turn every RPC into a fetch attempt.
 */
export class OAuthTokenProvider implements ITokenProvider {
    private readonly _logger = diag.createComponentLogger({
        namespace: '@cratis/chronicle/OAuthTokenProvider'
    });

    private _accessToken?: string;
    private _expiresAt = 0;
    private _lastFailedFetch?: number;
    private _refreshPromise?: Promise<string | undefined>;

    /**
     * Creates a new {@link OAuthTokenProvider}.
     * @param tokenEndpoint - The OAuth2 token endpoint to request tokens from.
     * @param clientId - The client identifier.
     * @param clientSecret - The client secret.
     * @param skipTlsValidation - Whether to skip TLS certificate chain validation.
     * @param _fetchToken - Test-only seam replacing the OAuth2 token request.
     */
    constructor(
        tokenEndpoint: string,
        clientId: string,
        clientSecret: string,
        skipTlsValidation: boolean = true,
        private readonly _fetchToken: () => Promise<OAuthTokenResponse> = () =>
            fetchOAuthAccessToken(tokenEndpoint, clientId, clientSecret, skipTlsValidation)
    ) {}

    async getAccessToken(): Promise<string | undefined> {
        if (this.hasFreshToken()) {
            return this._accessToken;
        }

        if (this._refreshPromise) {
            return this._refreshPromise;
        }

        if (this.isThrottled()) {
            return this.cachedTokenWhileValid();
        }

        this._refreshPromise = this.fetchAndCacheAccessToken();
        try {
            return await this._refreshPromise;
        } finally {
            this._refreshPromise = undefined;
        }
    }

    async refresh(): Promise<string | undefined> {
        this._accessToken = undefined;
        this._expiresAt = 0;
        this._lastFailedFetch = undefined;
        return this.getAccessToken();
    }

    private hasFreshToken(): boolean {
        return !!this._accessToken && this._expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS;
    }

    private isThrottled(): boolean {
        return this._lastFailedFetch !== undefined && Date.now() - this._lastFailedFetch < FAILED_FETCH_RETRY_DELAY_MS;
    }

    private cachedTokenWhileValid(): string | undefined {
        return this._accessToken && Date.now() < this._expiresAt ? this._accessToken : undefined;
    }

    private async fetchAndCacheAccessToken(): Promise<string | undefined> {
        try {
            const response = await this._fetchToken();
            this._accessToken = response.access_token;
            this._expiresAt = Date.now() + this.lifetimeSecondsFrom(response) * 1000;
            this._lastFailedFetch = undefined;
            return this._accessToken;
        } catch (error) {
            this._logger.warn('Failed to fetch OAuth2 token', {
                error: error instanceof Error ? error.message : String(error)
            });
            this._lastFailedFetch = Date.now();
            return this.cachedTokenWhileValid();
        }
    }

    // expires_in is RECOMMENDED but not required by OAuth2, and some servers send it
    // as a string.
    private lifetimeSecondsFrom(response: OAuthTokenResponse): number {
        const seconds = Number(response.expires_in);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_TOKEN_EXPIRY_SECONDS;
    }
}

export type TokenProvider = ITokenProvider;
