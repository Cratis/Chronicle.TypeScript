// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AddExternalServicesRequest } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ExternalServices } from '../../ExternalServices.js';

export class an_external_service_registration {
    sent = AddExternalServicesRequest.fromPartial({});
    readonly services: ExternalServices;

    constructor() {
        const connection = {
            externalServices: {
                addExternalServices: async (request: AddExternalServicesRequest) => {
                    this.sent = request;
                    return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [] };
                }
            }
        } as unknown as ChronicleConnection;
        this.services = new ExternalServices('store', connection);
    }
}
