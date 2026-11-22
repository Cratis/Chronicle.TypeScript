// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddWebhooksRequest, OAuthAuthorization } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IWebhookDefinitionBuilder } from '../IWebhookDefinitionBuilder.js';
import { a_webhook_registration } from './given/a_webhook_registration.js';

chai.should();

describe.each(['orders.read orders.write', ' orders.read  orders.write '])('when registering a webhook with OAuth scope "%s"', scope => {
    let context: a_webhook_registration;
    let oauth: OAuthAuthorization;
    let request: AddWebhooksRequest;
    let builder: IWebhookDefinitionBuilder;
    let returnedBuilder: IWebhookDefinitionBuilder;

    beforeEach(async () => {
        context = new a_webhook_registration();
        await context.webhooks.register('orders', 'https://example.test/webhook', configuration => {
            builder = configuration;
            returnedBuilder = configuration.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret', scope);
            returnedBuilder.withHeader('x-source', 'fake-app');
        });
        request = AddWebhooksRequest.decode(AddWebhooksRequest.encode(context.sent).finish());
        oauth = request.Webhooks[0].Target!.Authorization!.Value2!;
    });

    it('should return the original builder', () => returnedBuilder.should.equal(builder));
    it('should keep the event store', () => request.EventStore.should.equal('store'));
    it('should select OAuth authorization', () => chai.expect(oauth).not.to.be.undefined);
    it('should leave basic authorization unset', () => chai.expect(request.Webhooks[0].Target!.Authorization!.Value0).to.be.undefined);
    it('should leave bearer authorization unset', () => chai.expect(request.Webhooks[0].Target!.Authorization!.Value1).to.be.undefined);
    it('should preserve credentials and scope through the request codec', () => oauth.should.deep.equal({
        Authority: 'https://auth.example.test', ClientId: 'fake-client', ClientSecret: 'fake-secret', Scope: scope
    }));
    it('should retain chained headers', () => request.Webhooks[0].Target!.Headers['x-source'].should.equal('fake-app'));
    // The pinned 19.153.0 observation_webhooks contract uses length-delimited field 4 (tag 0x22) for Scope.
    it('should encode scope as protobuf field four', () => OAuthAuthorization.encode({
        ...oauth, Authority: '', ClientId: '', ClientSecret: ''
    }).finish().should.deep.equal(Uint8Array.from([0x22, scope.length, ...new TextEncoder().encode(scope)])));
});
