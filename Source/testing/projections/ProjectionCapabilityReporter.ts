// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import { UnsupportedProjectionOperation } from './UnsupportedProjectionOperation.js';

/** Resolves diagnostics back to their original declaration, including inferred AutoMap. */
export class ProjectionCapabilityReporter {
    constructor(private readonly compiled: CompiledProjectionDefinitions, private readonly definition: ProjectionDefinition) {}

    readonly reject = (path: string, reason: string, fallback?: string): never => {
        const model = String(this.definition.ReadModel ?? this.definition.Identifier ?? '<unknown>');
        throw new UnsupportedProjectionOperation(model, path, this.declaration(path, fallback), reason);
    };

    private declaration(path: string, fallback?: string): string {
        const provenance = this.compiled.provenance.get(this.definition);
        const exact = provenance?.find(entry => entry.contractPath === path)?.declaration;
        const join = provenance?.find(entry => entry.contractPath.startsWith('Join[') && path.startsWith(`${entry.contractPath}.`))?.declaration;
        return exact ?? join ?? fallback ?? this.inferred(path);
    }

    private inferred(path: string): string {
        const source = this.compiled.provenance.get(this.definition)?.find(entry => entry.contractPath.startsWith('From['))?.declaration ?? '.from';
        if (path.includes('.AutoMap.')) return `${source} (AutoMap)`;
        if (path.startsWith('InitialModelState')) return '.withInitialValues';
        if (path.startsWith('ReadModel')) return source;
        return 'contract';
    }
}
