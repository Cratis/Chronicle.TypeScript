// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a fluent builder for configuring an external service.
 */
export interface IExternalServiceBuilder {
    /**
     * Configures the service as an HTTP endpoint.
     * @param url - The base URL of the endpoint.
     * @returns The builder for chaining.
     */
    http(url: string): IExternalServiceBuilder;

    /**
     * Configures basic authentication for an HTTP endpoint.
     * @param username - The username.
     * @param password - The password.
     * @returns The builder for chaining.
     */
    withBasicAuth(username: string, password: string): IExternalServiceBuilder;

    /**
     * Configures bearer token authentication for an HTTP endpoint.
     * @param token - The bearer token.
     * @returns The builder for chaining.
     */
    withBearerToken(token: string): IExternalServiceBuilder;

    /**
     * Configures OAuth authentication for an HTTP endpoint.
     * @param authority - The OAuth authority.
     * @param clientId - The OAuth client id.
     * @param clientSecret - The OAuth client secret.
     * @returns The builder for chaining.
     */
    withOAuth(authority: string, clientId: string, clientSecret: string): IExternalServiceBuilder;

    /**
     * Adds a header to send with every HTTP request.
     * @param key - The header key.
     * @param value - The header value.
     * @returns The builder for chaining.
     */
    withHeader(key: string, value: string): IExternalServiceBuilder;

    /**
     * Configures the service as a Microsoft SQL Server database endpoint.
     * @param host - The database host.
     * @param database - The database name.
     * @param username - The username used to connect.
     * @param password - The password used to connect.
     * @param port - The database port. Leave as 0 to use the provider default.
     * @returns The builder for chaining.
     */
    msSql(host: string, database: string, username: string, password: string, port?: number): IExternalServiceBuilder;

    /**
     * Configures the service as a PostgreSQL database endpoint.
     * @param host - The database host.
     * @param database - The database name.
     * @param username - The username used to connect.
     * @param password - The password used to connect.
     * @param port - The database port. Leave as 0 to use the provider default.
     * @returns The builder for chaining.
     */
    postgreSql(host: string, database: string, username: string, password: string, port?: number): IExternalServiceBuilder;

    /**
     * Adds a provider-specific option to a database endpoint's connection options.
     * @param key - The option key.
     * @param value - The option value.
     * @returns The builder for chaining.
     */
    withOption(key: string, value: string): IExternalServiceBuilder;
}
