// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddExternalServicesRequest, ExternalServiceEndpointType } from '@cratis/chronicle.contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/index.js';
import { ChronicleCallFailed } from '../connection/callResults.js';
import type { IExternalServiceBuilder } from './IExternalServiceBuilder.js';
import { ExternalServices } from './ExternalServices.js';

function createServices(result = { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], AuthorizationFailureReason: '' }) {
    const addExternalServices = vi.fn().mockResolvedValue(result);
    const connection = { externalServices: { addExternalServices } } as unknown as ChronicleConnection;
    return { services: new ExternalServices('my-event-store', connection), addExternalServices };
}

async function requestFor(configure: (builder: IExternalServiceBuilder) => void): Promise<AddExternalServicesRequest> {
    const { services, addExternalServices } = createServices();
    await services.register('Customers', configure);
    expect(addExternalServices).toHaveBeenCalledTimes(1);
    // Round-trip through the generated codec to assert the actual wire request, not just the in-memory object.
    const request = AddExternalServicesRequest.fromPartial(addExternalServices.mock.calls[0][0]);
    return AddExternalServicesRequest.decode(AddExternalServicesRequest.encode(request).finish());
}

describe('ExternalServices registration', () => {
    it('sends an HTTP bearer endpoint with headers', async () => {
        expect(await requestFor(builder => builder.http('https://example.com')
            .withBearerToken('secret').withHeader('X-Tenant', 'acme').withHeader('X-Trace', 'enabled'))).toEqual({
            EventStore: 'my-event-store',
            ExternalServices: [{
                Id: 'Customers', Name: 'Customers', Endpoint: {
                    Type: ExternalServiceEndpointType.Http,
                    Http: {
                        Url: 'https://example.com', Headers: { 'X-Tenant': 'acme', 'X-Trace': 'enabled' },
                        Authorization: { Value0: undefined, Value1: { Token: 'secret' }, Value2: undefined }
                    },
                    Database: undefined
                }
            }]
        });
    });

    it('sends basic authorization', async () => {
        const request = await requestFor(builder => builder.http('https://example.com').withBasicAuth('user', 'password'));
        expect(request.ExternalServices[0].Endpoint?.Http?.Authorization).toEqual({
            Value0: { Username: 'user', Password: 'password' }, Value1: undefined, Value2: undefined
        });
        expect(request.ExternalServices[0].Endpoint?.Http?.Headers).toEqual({});
    });

    it('sends OAuth authorization', async () => {
        const request = await requestFor(builder => builder.http('https://example.com').withOAuth('https://auth', 'client', 'secret'));
        expect(request.ExternalServices[0].Endpoint?.Http?.Authorization).toEqual({
            Value0: undefined, Value1: undefined,
            Value2: { Authority: 'https://auth', ClientId: 'client', ClientSecret: 'secret' }
        });
    });

    it.each([
        ['msSql', ExternalServiceEndpointType.MsSql, 1433],
        ['postgreSql', ExternalServiceEndpointType.PostgreSql, 5432]
    ] as const)('sends %s with a port and options', async (method, type, port) => {
        const request = await requestFor(builder => builder[method]('db.example.com', 'customers', 'user', 'password', port)
            .withOption('sslmode', 'require'));
        expect(request.ExternalServices[0]).toEqual({
            Id: 'Customers', Name: 'Customers', Endpoint: {
                Type: type, Http: undefined,
                Database: {
                    Host: 'db.example.com', Port: port, Database: 'customers',
                    Username: 'user', Password: 'password', Options: { sslmode: 'require' }
                }
            }
        });
    });

    it('rejects a failed command result', async () => {
        const { services } = createServices({
            IsAuthorized: true, ValidationResults: [{ Message: 'invalid endpoint', Members: ['Endpoint'] }],
            ExceptionMessages: [], AuthorizationFailureReason: ''
        });
        await expect(services.register('Customers', builder => builder.http('https://example.com')))
            .rejects.toThrow(ChronicleCallFailed);
        await expect(services.register('Customers', builder => builder.http('https://example.com')))
            .rejects.toThrow(/register external service.*invalid endpoint/);
    });
});
