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

export class ContactDetails {
    @field(String)
    @pii()
    phone!: string;
}

@fromEvent(AccountOpened)
export class AccountDocument {
    @field(String)
    @subject()
    id!: string;

    @field(String)
    @pii()
    name!: string;

    @field(String)
    @pii()
    email!: string;

    @field(ContactDetails)
    contact!: ContactDetails;

    @field(Array, { genericArguments: [ContactDetails] })
    contacts!: ContactDetails[];
}

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
