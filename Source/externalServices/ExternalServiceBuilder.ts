// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    ExternalServiceDefinition,
    ExternalServiceEndpoint,
    ExternalServiceEndpointType,
    OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization
} from './ExternalServicesContracts';
import { IExternalServiceBuilder } from './IExternalServiceBuilder';

/**
 * Implements {@link IExternalServiceBuilder}.
 */
export class ExternalServiceBuilder implements IExternalServiceBuilder {
    private readonly _headers = new Map<string, string>();
    private readonly _options = new Map<string, string>();
    private _type = ExternalServiceEndpointType.Http;
    private _url = '';
    private _authorization: OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization | undefined;
    private _host = '';
    private _port = 0;
    private _database = '';
    private _username = '';
    private _password = '';

    /** @inheritdoc */
    http(url: string): IExternalServiceBuilder {
        this._type = ExternalServiceEndpointType.Http;
        this._url = url;
        return this;
    }

    /** @inheritdoc */
    withBasicAuth(username: string, password: string): IExternalServiceBuilder {
        this._authorization = {
            Value0: { Username: username, Password: password },
            Value1: undefined,
            Value2: undefined
        };
        return this;
    }

    /** @inheritdoc */
    withBearerToken(token: string): IExternalServiceBuilder {
        this._authorization = {
            Value0: undefined,
            Value1: { Token: token },
            Value2: undefined
        };
        return this;
    }

    /** @inheritdoc */
    withOAuth(authority: string, clientId: string, clientSecret: string): IExternalServiceBuilder {
        this._authorization = {
            Value0: undefined,
            Value1: undefined,
            Value2: { Authority: authority, ClientId: clientId, ClientSecret: clientSecret }
        };
        return this;
    }

    /** @inheritdoc */
    withHeader(key: string, value: string): IExternalServiceBuilder {
        this._headers.set(key, value);
        return this;
    }

    /** @inheritdoc */
    msSql(host: string, database: string, username: string, password: string, port = 0): IExternalServiceBuilder {
        return this.configureDatabase(ExternalServiceEndpointType.MsSql, host, database, username, password, port);
    }

    /** @inheritdoc */
    postgreSql(host: string, database: string, username: string, password: string, port = 0): IExternalServiceBuilder {
        return this.configureDatabase(ExternalServiceEndpointType.PostgreSql, host, database, username, password, port);
    }

    /** @inheritdoc */
    withOption(key: string, value: string): IExternalServiceBuilder {
        this._options.set(key, value);
        return this;
    }

    /**
     * Builds the external service definition.
     * @param id - The identifier of the external service.
     * @param name - The human-readable name of the external service.
     * @returns The built external service definition.
     */
    build(id: string, name: string): ExternalServiceDefinition {
        const endpoint: ExternalServiceEndpoint = { Type: this._type, Http: undefined, Database: undefined };

        if (this._type === ExternalServiceEndpointType.Http) {
            endpoint.Http = {
                Url: this._url,
                Authorization: this._authorization,
                Headers: Object.fromEntries(this._headers)
            };
        } else {
            endpoint.Database = {
                Host: this._host,
                Port: this._port,
                Database: this._database,
                Username: this._username,
                Password: this._password,
                Options: Object.fromEntries(this._options)
            };
        }

        return {
            Id: id,
            Name: name,
            Endpoint: endpoint
        };
    }

    private configureDatabase(type: ExternalServiceEndpointType, host: string, database: string, username: string, password: string, port: number): IExternalServiceBuilder {
        this._type = type;
        this._host = host;
        this._database = database;
        this._username = username;
        this._password = password;
        this._port = port;
        return this;
    }
}
