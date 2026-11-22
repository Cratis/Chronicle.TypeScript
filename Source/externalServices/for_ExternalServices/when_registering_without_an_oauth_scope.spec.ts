// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddExternalServicesRequest, OAuthAuthorization } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import { an_external_service_registration } from './given/an_external_service_registration.js';

chai.should();

describe.each([
    { condition: 'omitted', scope: undefined },
    { condition: 'empty', scope: '' },
    { condition: 'undefined', scope: undefined },
    { condition: 'null at runtime', scope: null as unknown as string }
])('when registering an external service with $condition OAuth scope', ({ condition, scope }) => {
    let context: an_external_service_registration;
    let oauth: OAuthAuthorization;
    let request: AddExternalServicesRequest;

    beforeEach(async () => {
        context = new an_external_service_registration();
        await context.services.register('OrdersApi', builder => {
            builder.http('https://example.test');
            const configured = condition === 'omitted'
                ? builder.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret')
                : builder.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret', scope);
            configured.withHeader('x-source', 'fake-app');
        });
        request = AddExternalServicesRequest.decode(AddExternalServicesRequest.encode(context.sent).finish());
        oauth = request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value2!;
    });

    it('should normalize scope before encoding', () => context.sent.ExternalServices[0].Endpoint!.Http!.Authorization!.Value2!.Scope.should.equal(''));
    it('should select OAuth authorization', () => chai.expect(oauth).not.to.be.undefined);
    it('should leave basic authorization unset', () => chai.expect(request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value0).to.be.undefined);
    it('should leave bearer authorization unset', () => chai.expect(request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value1).to.be.undefined);
    it('should preserve credentials and default scope through the request codec', () => oauth.should.deep.equal({
        Authority: 'https://auth.example.test', ClientId: 'fake-client', ClientSecret: 'fake-secret', Scope: ''
    }));
    it('should retain chained headers', () => request.ExternalServices[0].Endpoint!.Http!.Headers['x-source'].should.equal('fake-app'));
    it('should omit the default scope field from the wire', () => OAuthAuthorization.encode({
        ...oauth, Authority: '', ClientId: '', ClientSecret: ''
    }).finish().should.deep.equal(new Uint8Array()));
});
