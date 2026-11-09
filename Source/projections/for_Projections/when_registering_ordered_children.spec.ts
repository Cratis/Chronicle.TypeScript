// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { ChildrenOrderingNotSupportedByContracts } from '../ChildrenOrderingNotSupportedByContracts.js';
import { contractsSupportChildrenOrdering } from '../childrenOrderingSupport.js';
import { childrenFrom } from '../modelBound/childrenFrom.js';
import { Projections } from '../Projections.js';

chai.should();

class OrderLineAdded {
    lineId = '';
}
eventType()(OrderLineAdded);

class OrderLine {
    lineId = '';
}
field(String)(OrderLine.prototype, 'lineId');

class OrderWithOrderedLines {
    id = '';
    lines: OrderLine[] = [];
}
field(String)(OrderWithOrderedLines.prototype, 'id');
childrenFrom(OrderLineAdded, { childType: OrderLine, key: 'lineId', prepend: true })(OrderWithOrderedLines.prototype, 'lines');

const supported = contractsSupportChildrenOrdering();

describe('when registering a projection with ordered children', () => {
    let register: ReturnType<typeof vi.fn>;
    let registration: Promise<void>;

    beforeEach(() => {
        register = vi.fn().mockResolvedValue(undefined);
        const connection = {
            readModels: { registerMany: vi.fn().mockResolvedValue(undefined) },
            projections: { register }
        } as unknown as ChronicleConnection;
        const artifacts: IClientArtifactsProvider = {
            readModels: [OrderWithOrderedLines] as unknown as IClientArtifactsProvider['readModels'],
            projections: [], eventTypes: [], globalForHandlers: [], reducers: [], reactors: [],
            seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
        };
        registration = new Projections('store', 'namespace', connection, artifacts, 'sink').register();
        registration.catch(() => undefined);
    });

    it.runIf(!supported)('should fail registration until the contracts carry the ordering', async () => {
        const error = await registration.then(() => undefined, (reason: unknown) => reason);
        (error as Error).should.be.instanceOf(ChildrenOrderingNotSupportedByContracts);
        register.mock.calls.length.should.equal(0);
    });

    it.runIf(supported)('should send the ordering to the kernel', async () => {
        await registration;
        const request = register.mock.calls[0][0] as { Projections: Array<{ Children: Record<string, { Ordering?: { Placement: number } }> }> };
        request.Projections[0].Children.lines.Ordering!.Placement.should.equal(1);
    });
});
