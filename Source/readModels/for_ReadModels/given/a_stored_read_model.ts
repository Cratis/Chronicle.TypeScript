// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import type { ReleaseRequest, ReleaseResponse } from '@cratis/chronicle.contracts';
import { vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { pii } from '../../../compliance/pii.js';
import { subject } from '../../../compliance/subject.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import type { IReadModels } from '../../IReadModels.js';
import { ReadModels } from '../../ReadModels.js';

class AccountOpened {}

export class ContactDetails { phone!: string; }
field(String)(ContactDetails.prototype, 'phone');
pii()(ContactDetails.prototype, 'phone');

export class AccountDocument {
    id!: string;
    name!: string;
    email!: string;
    contact!: ContactDetails;
    contacts!: ContactDetails[];
}
field(String)(AccountDocument.prototype, 'id');
field(String)(AccountDocument.prototype, 'name');
field(String)(AccountDocument.prototype, 'email');
field(ContactDetails)(AccountDocument.prototype, 'contact');
field(Array, { genericArguments: [ContactDetails] })(AccountDocument.prototype, 'contacts');
subject()(AccountDocument.prototype, 'id');
pii()(AccountDocument.prototype, 'name');
pii()(AccountDocument.prototype, 'email');
fromEvent(AccountOpened)(AccountDocument);

export class a_stored_read_model {
    readonly release = vi.fn<(request: ReleaseRequest) => Promise<ReleaseResponse>>()
        .mockImplementation(async request => ({ HasError: false, Error: '', Payload: request.Payload }));
    readonly readModels: IReadModels;

    constructor() {
        const connection = { compliance: { release: this.release } } as unknown as ChronicleConnection;
        const artifacts: IClientArtifactsProvider = {
            eventTypes: [], readModels: [AccountDocument], projections: [], reducers: [], reactors: [],
            seeders: [], constraints: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
        };
        this.readModels = new ReadModels('store', 'tenant', connection, artifacts, 'sink');
    }

    requestFor(subject: string): ReleaseRequest {
        return this.release.mock.calls.map(([request]) => request).find(request => request.Subject === subject)!;
    }
}
