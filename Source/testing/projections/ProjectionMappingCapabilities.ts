// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';
import { ProjectionExpressionCapabilities } from './ProjectionExpressionCapabilities.js';
import { ProjectionSchemaCapabilities } from './ProjectionSchemaCapabilities.js';
import type { ProjectionMappingValidation } from './ProjectionMappingValidation.js';

/** Checks explicit mappings and inferred AutoMap through the same schema boundary. */
export class ProjectionMappingCapabilities {
    constructor(private readonly schema: JsonSchema, private readonly reject: ProjectionCapabilityReject, private readonly accumulators = new Set<string>()) {}

    check(mapping: ProjectionMappingValidation): void {
        const { eventSchema, destination, expression, path } = mapping;
        const fail = (reason: string): never => this.reject(path, `expression '${expression}': ${reason}`);
        const target = this.schema.properties?.[destination] ?? fail('dynamic or unknown destination paths require a kernel-backed test');
        this.checkDestination(mapping, fail);
        this.checkTarget(target, mapping, fail);
        if (ProjectionExpressionCapabilities.check(expression, target, eventSchema, fail)) return;
        if (/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/.test(expression)) {
            return this.property(mapping, fail);
        }
        if (expression.startsWith('$context.')) fail('is a legacy expression the kernel does not resolve; event-context mappings use $eventContext(...)');
        fail('requires a kernel-backed test');
    }

    autoMap(eventSchema: JsonSchema, explicit: Record<string, string>, exclusions: string[], path: string): void {
        for (const property of Object.keys(this.schema.properties ?? {})) {
            if (this.includes(Object.keys(explicit), property) || this.includes(exclusions, property)) continue;
            this.autoMapProperty(eventSchema, property, path);
        }
    }

    private checkTarget(target: JsonSchema, { path }: ProjectionMappingValidation, fail: (reason: string) => never): void {
        if (target.type === 'object' || target.type === 'array') fail('object/array target mappings require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        ProjectionSchemaCapabilities.check(target, path, (_path, reason) => fail(reason));
    }

    private autoMapProperty(eventSchema: JsonSchema, destination: string, path: string): void {
        const matches = Object.keys(eventSchema.properties ?? {}).filter(name => name.toLowerCase() === destination.toLowerCase());
        if (matches.length > 1) this.reject(`${path}.AutoMap.${destination}`, `inferred AutoMap source is ambiguous: ${matches.join(', ')}`);
        if (matches.length) this.check({ eventSchema, destination, expression: matches[0], path: `${path}.AutoMap.${destination}` });
    }

    private includes(names: string[], property: string): boolean {
        return names.some(name => name.toLowerCase() === property.toLowerCase());
    }

    private checkDestination({ destination }: ProjectionMappingValidation, fail: (reason: string) => never): void {
        if (destination.includes('.') || destination.includes('$')) fail('dynamic or unknown destination paths require a kernel-backed test');
        const collision = Object.keys(this.schema.properties ?? {}).some(name => name !== destination && name.toLowerCase() === destination.toLowerCase());
        if (destination.toLowerCase() === 'id' || collision) {
            fail('identifier or case-insensitively colliding target mappings require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        }
    }

    private property(mapping: ProjectionMappingValidation, fail: (reason: string) => never): void {
        const { eventSchema, destination, expression, path } = mapping;
        this.checkSourcePath(mapping, fail);
        const source = eventSchema.properties?.[expression] ?? fail(`event property '${expression}' is absent from the participating event schema`);
        ProjectionSchemaCapabilities.check(source, path, (_path, reason) => fail(reason));
        this.checkAccumulator(source, destination, fail);
        this.compatibility(source, mapping, fail);
    }

    private checkSourcePath({ expression }: ProjectionMappingValidation, fail: (reason: string) => never): void {
        if (['true', 'True', 'false', 'False'].includes(expression)) fail('kernel resolves this expression as a boolean literal before event content');
        if (expression.includes('.')) fail('nested event property paths require a kernel-backed test');
    }

    private compatibility(source: JsonSchema, { destination, expression }: ProjectionMappingValidation, fail: (reason: string) => never): void {
        const target = this.schema.properties![destination];
        if (!ProjectionSchemaCapabilities.compatible(source, target)) {
            fail(`source '${expression}' (${source.type}${source.format ? `/${source.format}` : ''}) to target '${destination}' (${target.type}${target.format ? `/${target.format}` : ''}) requires a kernel-backed test`);
        }
    }

    private checkAccumulator(source: JsonSchema, destination: string, fail: (reason: string) => never): void {
        if (this.accumulators.has(destination) && !ProjectionSchemaCapabilities.numeric(source)) {
            fail('assigning non-numeric event properties to an arithmetic accumulator requires a kernel-backed test; missing values can clear it');
        }
    }

}
