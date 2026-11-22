// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddWebhooksRequest, OAuthAuthorization } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import { a_webhook_registration } from './given/a_webhook_registration.js';

chai.should();

describe.each([
    { condition: 'omitted', scope: undefined },
    { condition: 'empty', scope: '' },
    { condition: 'undefined', scope: undefined },
    { condition: 'null at runtime', scope: null as unknown as string }
])('when registering a webhook with $condition OAuth scope', ({ condition, scope }) => {
    let context: a_webhook_registration;
    let oauth: OAuthAuthorization;
    let request: AddWebhooksRequest;

    beforeEach(async () => {
        context = new a_webhook_registration();
        await context.webhooks.register('orders', 'https://example.test/webhook', builder => {
            const configured = condition === 'omitted'
                ? builder.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret')
                : builder.withOAuth('https://auth.example.test', 'fake-client', 'fake-secret', scope);
            configured.withHeader('x-source', 'fake-app');
        });
        request = AddWebhooksRequest.decode(AddWebhooksRequest.encode(context.sent).finish());
        oauth = request.Webhooks[0].Target!.Authorization!.Value2!;
    });

    it('should normalize scope before encoding', () => context.sent.Webhooks[0].Target!.Authorization!.Value2!.Scope.should.equal(''));
    it('should select OAuth authorization', () => chai.expect(oauth).not.to.be.undefined);
    it('should leave basic authorization unset', () => chai.expect(request.Webhooks[0].Target!.Authorization!.Value0).to.be.undefined);
    it('should leave bearer authorization unset', () => chai.expect(request.Webhooks[0].Target!.Authorization!.Value1).to.be.undefined);
    it('should preserve credentials and default scope through the request codec', () => oauth.should.deep.equal({
        Authority: 'https://auth.example.test', ClientId: 'fake-client', ClientSecret: 'fake-secret', Scope: ''
    }));
    it('should retain chained headers', () => request.Webhooks[0].Target!.Headers['x-source'].should.equal('fake-app'));
    it('should omit the default scope field from the wire', () => OAuthAuthorization.encode({
        ...oauth, Authority: '', ClientId: '', ClientSecret: ''
    }).finish().should.deep.equal(new Uint8Array()));
});
