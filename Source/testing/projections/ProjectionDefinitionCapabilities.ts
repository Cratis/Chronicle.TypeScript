// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';
import type { ContractEventType } from '../../projections/declarative/ProjectionBuilderCore.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { ProjectionCapabilityProvenance } from '../../projections/ProjectionCapabilityProvenance.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';

/** Subscription shapes that must be rejected before inspecting any model schema. */
export class ProjectionDefinitionCapabilities {
    static validate(wire: Record<string, unknown>, provenance: readonly ProjectionCapabilityProvenance[], reject: ProjectionCapabilityReject): void {
        if (provenance.find(entry => entry.contractPath === 'Variant')) reject('Variant', 'variants require a kernel-backed test');
        this.subscription(wire, reject);
        for (const section of ['Nested', 'RemovedWithJoin']) this.unsupportedSection(wire, section, reject);
        if ((wire.FromEvery as unknown[] | undefined)?.length) reject('FromEvery', 'derivative projections require a kernel-backed test');
        if (wire.FromEventProperty) reject('FromEventProperty', 'event-property subscriptions require a kernel-backed test');
        this.all(wire, provenance, reject);
    }

    private static subscription(wire: Record<string, unknown>, reject: ProjectionCapabilityReject): void {
        if (wire.IsActive === false) reject('IsActive', 'passive projections require a kernel-backed test');
        if (wire.SubscribesToAllEvents === true) reject('SubscribesToAllEvents', 'subscribe-to-all projections require a kernel-backed test');
        if (wire.EventSequenceId !== EventSequenceId.eventLog.value) reject('EventSequenceId', 'non-default event sequences require a kernel-backed test');
    }

    private static unsupportedSection(wire: Record<string, unknown>, section: string, reject: ProjectionCapabilityReject): void {
        const value = wire[section];
        const paths = Array.isArray(value) ? value.map((entry: { Key: ContractEventType }) => eventContractPath(section, entry.Key))
            : Object.keys(value as Record<string, unknown> ?? {}).map(property => `${section}.${property}`);
        if (paths.length) reject(paths[0], `${section === 'Nested' ? 'nested projections' : 'removedWithJoin'} require a kernel-backed test`);
    }

    private static all(wire: Record<string, unknown>, provenance: readonly ProjectionCapabilityProvenance[], reject: ProjectionCapabilityReject): void {
        const all = wire.All as { Properties?: Record<string, string>; IncludeChildren?: boolean; AutoMap?: AutoMap } | undefined;
        if (provenance.some(entry => entry.contractPath === 'All') || this.hasAllMappings(all)) {
            reject('All', 'fromEvery/all subscriptions require a kernel-backed test');
        }
    }

    private static hasAllMappings(all: { Properties?: Record<string, string>; IncludeChildren?: boolean; AutoMap?: AutoMap } | undefined): boolean {
        return !!(all?.IncludeChildren || Object.keys(all?.Properties ?? {}).length || all?.AutoMap === AutoMap.Enabled);
    }
}
