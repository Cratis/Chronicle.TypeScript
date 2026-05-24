// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as http from 'http';
import * as https from 'https';

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

/**
 * Interface for providing authentication tokens.
 */
export interface ITokenProvider {
    /**
     * Gets the current access token.
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

interface OAuthTokenResponse {
    access_token: string;
    expires_in: number;
}

/**
 * OAuth token provider using client credentials flow.
 */
export class OAuthTokenProvider implements ITokenProvider {
    private _accessToken?: string;
    private _tokenExpiry = new Date(0);
    private _refreshPromise?: Promise<string | undefined>;

    constructor(
        private readonly _tokenEndpoint: string,
        private readonly _clientId: string,
        private readonly _clientSecret: string
    ) {}

    async getAccessToken(): Promise<string | undefined> {
        if (this._accessToken && new Date() < this._tokenExpiry) {
            return this._accessToken;
        }

        if (this._refreshPromise) {
            return this._refreshPromise;
        }

        this._refreshPromise = this.fetchAccessToken();
        try {
            return await this._refreshPromise;
        } finally {
            this._refreshPromise = undefined;
        }
    }

    async refresh(): Promise<string | undefined> {
        this._accessToken = undefined;
        this._tokenExpiry = new Date(0);
        return this.getAccessToken();
    }

    private async fetchAccessToken(): Promise<string | undefined> {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this._clientId);
        params.append('client_secret', this._clientSecret);

        const body = params.toString();

        return new Promise((resolve, reject) => {
            const url = new URL(this._tokenEndpoint);
            const httpModule = url.protocol === 'https:' ? https : http;

            const req = httpModule.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, response => {
                let data = '';

                response.on('data', chunk => {
                    data += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Token request failed with status ${response.statusCode}: ${data}`));
                        return;
                    }

                    try {
                        const tokenResponse = JSON.parse(data) as OAuthTokenResponse;
                        this._accessToken = tokenResponse.access_token;
                        const expiresInSeconds = tokenResponse.expires_in || 3600;
                        this._tokenExpiry = new Date(Date.now() + (expiresInSeconds - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000);
                        resolve(this._accessToken);
                    } catch (error) {
                        reject(new Error(`Failed to parse token response: ${error instanceof Error ? error.message : String(error)}`));
                    }
                });
            });

            req.on('error', error => {
                reject(new Error(`Token request failed: ${error.message}`));
            });

            req.write(body);
            req.end();
        });
    }
}

export type TokenProvider = ITokenProvider;