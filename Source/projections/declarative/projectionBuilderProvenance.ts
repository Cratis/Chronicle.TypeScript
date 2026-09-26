// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Internal declaration origins; never part of a builder or its published interface. */
interface BuilderProvenance {
    fromEvery: boolean;
    keys: Map<string, string>;
    children: Map<string, string>;
}

const declarations = new WeakMap<object, BuilderProvenance>();

function forBuilder(builder: object): BuilderProvenance {
    let provenance = declarations.get(builder);
    if (!provenance) {
        provenance = { fromEvery: false, keys: new Map(), children: new Map() };
        declarations.set(builder, provenance);
    }
    return provenance;
}

/** Records an explicit key operation on a from builder or projection builder. */
export function recordKeyDeclaration(builder: object, path: string, declaration: string): void {
    forBuilder(builder).keys.set(path, declaration);
}

/** Records a child addition without adding state to the public builder type. */
export function recordChildDeclaration(builder: object, path: string, declaration: string): void {
    forBuilder(builder).children.set(path, declaration);
}

/** Remembers empty fromEvery declarations, which have no wire representation. */
export function recordFromEveryDeclaration(builder: object): void {
    forBuilder(builder).fromEvery = true;
}

/** Reads declaration origins while compiling, before variant lowering. */
export function getProjectionBuilderProvenance(builder: object): Readonly<BuilderProvenance> {
    return forBuilder(builder);
}
