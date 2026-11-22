// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddExternalServicesRequest, OAuthAuthorization } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IExternalServiceBuilder } from '../IExternalServiceBuilder.js';
import { an_external_service_registration } from './given/an_external_service_registration.js';

chai.should();

describe.each(['orders.read orders.write', ' orders.read  orders.write '])('when registering an external service with OAuth scope "%s"', scope => {
    let context: an_external_service_registration;
    let oauth: OAuthAuthorization;
    let request: AddExternalServicesRequest;
    let builder: IExternalServiceBuilder;
    let returnedBuilder: IExternalServiceBuilder;

    beforeEach(async () => {
        context = new an_external_service_registration();
        await context.services.register('OrdersApi', configuration => {
            builder = configuration.http('https://example.test');
            returnedBuilder = builder.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret', scope);
            returnedBuilder.withHeader('x-source', 'fake-app');
        });
        request = AddExternalServicesRequest.decode(AddExternalServicesRequest.encode(context.sent).finish());
        oauth = request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value2!;
    });

    it('should return the original builder', () => returnedBuilder.should.equal(builder));
    it('should keep the event store', () => request.EventStore.should.equal('store'));
    it('should select OAuth authorization', () => chai.expect(oauth).not.to.be.undefined);
    it('should leave basic authorization unset', () => chai.expect(request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value0).to.be.undefined);
    it('should leave bearer authorization unset', () => chai.expect(request.ExternalServices[0].Endpoint!.Http!.Authorization!.Value1).to.be.undefined);
    it('should preserve credentials and scope through the request codec', () => oauth.should.deep.equal({
        Authority: 'https://auth.example.test', ClientId: 'fake-client', ClientSecret: 'fake-secret', Scope: scope
    }));
    it('should retain chained headers', () => request.ExternalServices[0].Endpoint!.Http!.Headers['x-source'].should.equal('fake-app'));
    // The pinned 19.153.0 externalservices contract uses length-delimited field 4 (tag 0x22) for Scope.
    it('should encode scope as protobuf field four', () => OAuthAuthorization.encode({
        ...oauth, Authority: '', ClientId: '', ClientSecret: ''
    }).finish().should.deep.equal(Uint8Array.from([0x22, scope.length, ...new TextEncoder().encode(scope)])));
});
