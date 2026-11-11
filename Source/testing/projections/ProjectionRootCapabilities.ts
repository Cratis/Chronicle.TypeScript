// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionArithmetic } from './ProjectionArithmetic.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';
import type { ProjectionEventSchemaResolver } from './ProjectionEventSchemaResolver.js';
import { ProjectionMappingCapabilities } from './ProjectionMappingCapabilities.js';

/** Validates root subscriptions and accumulator interactions before child traversal. */
export class ProjectionRootCapabilities {
    readonly from: FromRecord[];
    readonly removedWith: RemovedWithRecord[];

    constructor(private readonly schema: JsonSchema, private readonly wire: Record<string, unknown>, private readonly reject: ProjectionCapabilityReject) {
        this.from = wire.From as FromRecord[] ?? [];
        this.removedWith = wire.RemovedWith as RemovedWithRecord[] ?? [];
    }

    validate(resolver: ProjectionEventSchemaResolver): void {
        this.checkOverlaps();
        const accumulators = new Set(this.from.flatMap(entry => Object.entries(entry.Value.Properties ?? {})
            .filter(([, expression]) => ProjectionArithmetic.isArithmetic(expression)).map(([property]) => property)));
        this.checkAccumulatorChildren(accumulators);
        for (const entry of this.from) this.checkClearedAccumulators(entry, accumulators);
        const mappings = new ProjectionMappingCapabilities(this.schema, this.reject, accumulators);
        for (const entry of [...this.from, ...this.removedWith]) this.subscription(entry, resolver, mappings);
    }

    private checkOverlaps(): void {
        for (const entry of this.from) {
            if (this.removedWith.some(removal => removal.Key.Id === entry.Key.Id)) {
                this.reject(eventContractPath('From', entry.Key), 'events subscribed through both From and RemovedWith require a kernel-backed test (ChronicleKernelScenario / live kernel)');
            }
        }
    }

    private checkAccumulatorChildren(accumulators: Set<string>): void {
        if (accumulators.size && Object.keys(this.wire.Children as object ?? {}).length) {
            this.reject('Children', 'root arithmetic combined with children requires a kernel-backed test');
        }
    }

    private checkClearedAccumulators(entry: FromRecord, accumulators: Set<string>): void {
        for (const [property, expression] of Object.entries(entry.Value.Properties ?? {})) {
            if (expression === '$null' && accumulators.has(property)) {
                this.reject(`${eventContractPath('From', entry.Key)}.Properties.${property}`,
                    'clearing an arithmetic accumulator requires a kernel-backed test; the kernel rejects arithmetic on a present null');
            }
        }
    }

    private subscription(entry: FromRecord | RemovedWithRecord, resolver: ProjectionEventSchemaResolver, mappings: ProjectionMappingCapabilities): void {
        const section = this.from.includes(entry as FromRecord) ? 'From' : 'RemovedWith';
        const path = eventContractPath(section, entry.Key);
        const eventSchema = resolver.require(entry.Key, path);
        if (entry.Value.Key !== '$eventSourceId') this.reject(`${path}.Key`, 'only $eventSourceId keys are supported');
        if (entry.Value.ParentKey) this.reject(`${path}.ParentKey`, 'parent keys require a kernel-backed test');
        if (section === 'RemovedWith') return;
        this.properties(entry as FromRecord, eventSchema, path, mappings);
    }

    private properties(entry: FromRecord, eventSchema: JsonSchema, path: string, mappings: ProjectionMappingCapabilities): void {
        const properties = entry.Value.Properties ?? {};
        for (const [property, expression] of Object.entries(properties)) {
            mappings.check({ eventSchema, destination: property, expression, path: `${path}.Properties.${property}` });
        }
        if (this.wire.AutoMap !== AutoMap.Disabled && !ProjectionArithmetic.suppressesAutoMap(properties)) {
            mappings.autoMap(eventSchema, properties, this.wire.NoAutoMapProperties as string[] ?? [], path);
        }
    }
}
