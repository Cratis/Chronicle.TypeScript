// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as http from 'http';
import * as https from 'https';

/**
 * The shape of a successful OAuth2 token response.
 */
export interface OAuthTokenResponse {
    access_token: string;

    /** RECOMMENDED but not required by OAuth2, and some servers send it as a string. */
    expires_in?: number | string;
}

/**
 * Requests an access token from an OAuth2 token endpoint using the client credentials flow.
 * @param tokenEndpoint - The token endpoint URL.
 * @param clientId - The client identifier.
 * @param clientSecret - The client secret.
 * @param skipTlsValidation - Whether to skip TLS certificate chain validation.
 * @returns The parsed token response; rejects when the request fails or the response is not a valid token.
 */
export function fetchOAuthAccessToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    skipTlsValidation: boolean
): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const body = params.toString();

    return new Promise((resolve, reject) => {
        const url = new URL(tokenEndpoint);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const request = httpModule.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            },
            // Chain validation is skipped only when skipTlsValidation is explicitly set,
            // matching the gRPC channel's credentials for the same connection string.
            ...(isHttps && skipTlsValidation ? { rejectUnauthorized: false } : {})
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
                    if (!tokenResponse.access_token) {
                        reject(new Error('Token response did not contain an access_token'));
                        return;
                    }

                    resolve(tokenResponse);
                } catch (error) {
                    reject(new Error(`Failed to parse token response: ${error instanceof Error ? error.message : String(error)}`));
                }
            });
        });

        request.on('error', error => {
            reject(new Error(`Token request failed: ${error.message}`));
        });

        request.write(body);
        request.end();
    });
}
