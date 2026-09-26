#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

import json
import re
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = REPO_ROOT / "Source"
SNIPPET_ROOT = REPO_ROOT / "Documentation" / "client-snippets"
GENERATED_DIR = SOURCE_ROOT / ".docs-snippets"
GENERATED_SOURCE = GENERATED_DIR / "snippets.ts"
GENERATED_SDK_ENTRY = GENERATED_DIR / "sdk-entry.ts"
GENERATED_INVALID_CHECK = GENERATED_DIR / "invalid-check.mjs"
GENERATED_TSCONFIG = GENERATED_DIR / "tsconfig.json"
FENCE_RE = re.compile(r"```([^\s`]+)[^\n]*\n(.*?)\n```", re.DOTALL)
NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/chronicle['\"];?\s*$")
CONTRACTS_NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/chronicle\.contracts['\"];?\s*$")
FUNDAMENTALS_NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/fundamentals['\"];?\s*$")
SIDE_EFFECT_IMPORT_RE = re.compile(r"^import\s+['\"]([^'\"]+)['\"];?\s*$")
UNSUPPORTED_SNIPPET_MARKER = "does not support this workflow yet"
CLASS_RE = re.compile(r"^[ \t]*(?:export\s+)?(?:(?:default|abstract)\s+)*class\s+(\w+)\b", re.MULTILINE)
VALIDATION_EXCLUDED_PREFIXES = ("legacy/",)
# These examples intentionally throw during decoration or schema generation.
RUNTIME_INVALID_ERRORS = {
    "confidentiality/encrypted/pii-and-encrypted-restriction": "PIIAndEncryptedCombinedNotSupported",
    "compliance/pii-with-concepts/event-source-id-restriction": "PIINotSupportedOnEventSourceId",
    "compliance/client/event-source-id-restriction": "PIINotSupportedOnEventSourceId",
    "compliance/pii/event-source-id-restriction": "PIINotSupportedOnEventSourceId",
    "confidentiality/encrypted/event-source-id-restriction": "EncryptedNotSupportedOnEventSourceId",
}

BODY_SNIPPETS = {
    "get-started/client-flow": "",
    "events/appending/schema-validation": """
        const eventSourceId = 'order-123';
        const customerId = 'customer-42';
        const total = 42;
    """,
    "read-models/getting-single-instance/basic": """
        const accountId = 'account-42';
        // The canonical method remains non-nullable for existing clients.
        const required: AccountInfo = await store.readModels.getInstanceById(AccountInfo, accountId);
        // A missing read model can be detected with the nullable convenience method.
        // @ts-expect-error findInstanceById can return null.
        const absent: AccountInfo = await store.readModels.findInstanceById(AccountInfo, accountId);
    """,
    "read-models/getting-collection-instances/basic": "",
    "read-models/getting-collection-instances/filtering": """
        const threshold = 1000;
    """,
    "read-models/getting-collection-instances/event-count": "",
    "read-models/getting-snapshots/basic": """
        const orderId = 'order-123';
    """,
    "read-models/getting-snapshots/analyze": """
        const orderId = 'order-123';
    """,
    "read-models/watching-read-models/basic": "",
    "read-models/watching-read-models/filtering": """
        const threshold = 1000;
    """,
    "projections/projection-declaration-language/adhoc-querying/basic": "",
    "projections/projection-declaration-language/adhoc-querying/inferred-vs-explicit": "",
    "projections/projection-declaration-language/adhoc-querying/type-mismatch": "",
    "projections/projection-declaration-language/adhoc-querying/custom-sequence": "",
    "projections/projection-declaration-language/adhoc-querying/error-handling": "",
    "contributing/clients/typescript-grpc-package/event-stores-definition": "",
    "contributing/clients/typescript-grpc-package/namespaces-definition": "",
    "contributing/clients/typescript-grpc-package/request-messages": "",
    "contributing/clients/typescript-grpc-package/service-types": "",
}

COMMON_DECLARATIONS = [
    """
    class AccountInfo {
        name = '';
        balance = 0;
    }
    """,
    """
    class Account {
        id = '';
        name = '';
        balance = 0;
        createdDate = new Date();
    }
    """,
    """
    enum OrderStatus {
        New = 'New',
        Confirmed = 'Confirmed',
        Shipped = 'Shipped',
        Completed = 'Completed'
    }
    """,
    """
    class Order {
        id = '';
        status = OrderStatus.New;
        totalAmount = 0;
    }
    """,
]


def snippet_files() -> list[Path]:
    files = [
        path
        for path in sorted([*SNIPPET_ROOT.rglob("*.md"), *SNIPPET_ROOT.rglob("*.mdx")])
        if not snippet_key(path).startswith(VALIDATION_EXCLUDED_PREFIXES)
    ]
    snippets = {}
    for path in files:
        key = snippet_key(path)
        if key in snippets:
            raise ValueError(f"Duplicate client snippet {key}: {snippets[key]} and {path.relative_to(REPO_ROOT)}")
        snippets[key] = path.relative_to(REPO_ROOT)
    return files


def snippet_key(path: Path) -> str:
    return path.relative_to(SNIPPET_ROOT).with_suffix("").as_posix()


def extract_snippet(path: Path) -> str | None:
    raw = path.read_text(encoding="utf-8")
    matches = FENCE_RE.findall(raw)
    if len(matches) != 1:
        raise ValueError(f"{path.relative_to(REPO_ROOT)} must contain exactly one fenced TypeScript snippet")

    language, code = matches[0]
    if language == "text" and UNSUPPORTED_SNIPPET_MARKER in code:
        return None
    if language != "typescript":
        raise ValueError(f"{path.relative_to(REPO_ROOT)} must use a typescript code fence, got {language!r}")

    return code.strip()


def split_imports(
    code: str,
    named_imports: set[str],
    contracts_named_imports: set[str],
    fundamentals_named_imports: set[str],
    side_effect_imports: set[str],
) -> str:
    body: list[str] = []
    for line in code.splitlines():
        named_match = NAMED_IMPORT_RE.match(line)
        if named_match:
            for imported in named_match.group(1).split(","):
                imported = imported.strip()
                if imported:
                    named_imports.add(imported)
            continue

        contracts_named_match = CONTRACTS_NAMED_IMPORT_RE.match(line)
        if contracts_named_match:
            for imported in contracts_named_match.group(1).split(","):
                imported = imported.strip()
                if imported:
                    contracts_named_imports.add(imported)
            continue

        fundamentals_named_match = FUNDAMENTALS_NAMED_IMPORT_RE.match(line)
        if fundamentals_named_match:
            for imported in fundamentals_named_match.group(1).split(","):
                imported = imported.strip()
                if imported:
                    fundamentals_named_imports.add(imported)
            continue

        side_effect_match = SIDE_EFFECT_IMPORT_RE.match(line)
        if side_effect_match:
            side_effect_imports.add(side_effect_match.group(1))
            continue

        body.append(line)

    return "\n".join(body).strip()


def function_name(relative_path: str) -> str:
    return "snippet_" + re.sub(r"[^A-Za-z0-9_]", "_", relative_path)


def generate_source(runtime: bool = False) -> str:
    files = snippet_files()
    if not files:
        raise ValueError(f"No client snippets found in {SNIPPET_ROOT}")

    named_imports = {"IEventStore"}
    if runtime:
        named_imports.update({"getEventTypeMetadata", "getReadModelMetadata", "TypeDiscoverer", "hasModelBoundProperties", "DefaultClientArtifactsProvider", "validateArtifactSchemas", "ProjectionDefinitionCompiler", "isModelBoundProjection", "rootReadModelTypes"})
    contracts_named_imports: set[str] = set()
    fundamentals_named_imports: set[str] = set()
    side_effect_imports = {"reflect-metadata"}
    declarations: list[str] = [textwrap.dedent(declaration).strip() for declaration in COMMON_DECLARATIONS]
    functions: list[str] = []
    classes: list[tuple[str, str]] = []

    for path in files:
        relative_path = snippet_key(path)
        snippet = extract_snippet(path)
        if snippet is None or (runtime and relative_path in RUNTIME_INVALID_ERRORS):
            continue

        body = split_imports(snippet, named_imports, contracts_named_imports, fundamentals_named_imports, side_effect_imports)
        if runtime and not CLASS_RE.search(body):
            continue

        if relative_path in BODY_SNIPPETS:
            prelude = textwrap.dedent(BODY_SNIPPETS[relative_path]).strip()
            lines = [line for line in [prelude, body] if line]
            function_body = textwrap.indent("\n\n".join(lines), "    ")
            functions.append(f"async function {function_name(relative_path)}(store: IEventStore): Promise<void> {{\n{function_body}\n}}")
        else:
            declarations.append(body)
            classes.extend((relative_path, name) for name in CLASS_RE.findall(body))

    imports = [
        *[f"import '{module_name}';" for module_name in sorted(side_effect_imports)],
        f"import {{ {', '.join(sorted(named_imports))} }} from '{'../sdk.mjs' if runtime else '../index'}';",
    ]
    if contracts_named_imports:
        imports.append(f"import {{ {', '.join(sorted(contracts_named_imports))} }} from '@cratis/chronicle.contracts';")
    if fundamentals_named_imports:
        imports.append(f"import {{ {', '.join(sorted(fundamentals_named_imports))} }} from '@cratis/fundamentals';")

    schema_checks = [
        "const snippetClasses = [",
        *[f"    [{json.dumps(path)}, {name}]," for path, name in classes],
        "] as const;",
        "// Discovery tracks property-only models when their modules are imported.",
        "for (const [, type] of snippetClasses) {",
        "    if (hasModelBoundProperties(type)) TypeDiscoverer.default.trackModelBoundProperty(type);",
        "}",
        "const artifacts = DefaultClientArtifactsProvider.default;",
        "const registeredReadModels = new Set(artifacts.readModels);",
        "const schemaFailures: string[] = [];",
        "let checkedSchemas = 0;",
        "for (const [path, type] of snippetClasses) {",
        "    try {",
        "        if (getEventTypeMetadata(type)) {",
        "            validateArtifactSchemas({ ...artifacts, eventTypes: [type], readModels: [] });",
        "            checkedSchemas++;",
        "        } else if (getReadModelMetadata(type) || registeredReadModels.has(type)) {",
        "            validateArtifactSchemas({ ...artifacts, eventTypes: [], readModels: [type] });",
        "            checkedSchemas++;",
        "        }",
        "    } catch (error) {",
        "        const details = error instanceof AggregateError ? error.errors.map(String).join('; ') : String(error);",
        "        schemaFailures.push(`${path}: ${details}`);",
        "    }",
        "}",
        "if (!checkedSchemas && !schemaFailures.length) throw new Error('No event or read-model schemas were checked.');",
        "if (schemaFailures.length) throw new Error(`${schemaFailures.length} schema error(s):\\n${schemaFailures.join('\\n')}`);",
        "// Also exercise the complete artifact set as EventStore does at startup.",
        "validateArtifactSchemas(artifacts);",
        "console.log(`Standard decorators: ${checkedSchemas} event/read-model schemas validated.`);",
        "// Compile each root separately: independent snippets can intentionally share read-model IDs.",
        "const modelBoundReadModels = rootReadModelTypes(artifacts).filter(isModelBoundProjection);",
        "const declarativeProjections = artifacts.projections;",
        "const projectionPaths = new Map(snippetClasses.map(([path, type]) => [type, path]));",
        "const definitions = [];",
        "for (const [type, modelBound] of [",
        "    ...declarativeProjections.map(type => [type, false]),",
        "    ...modelBoundReadModels.map(type => [type, true]),",
        "]) {",
        "    const path = projectionPaths.get(type) ?? type.name;",
        "    try {",
        "        const compiled = new ProjectionDefinitionCompiler(artifacts, 'docs-snippet-sink')",
        "            .compile(modelBound ? [] : [type], modelBound ? [type] : []);",
        "        if (compiled.definitions.length !== 1) throw new Error('Expected one projection definition.');",
        "        definitions.push(...compiled.definitions);",
        "    } catch (error) {",
        "        throw new Error(`${path}: projection definition compilation failed: ${String(error)}`, { cause: error });",
        "    }",
        "}",
        "if (!definitions.length) throw new Error('No projection definitions were checked.');",
        "// A child or nested scalar clear must map to $null, never remove its containing object.",
        "for (const [path, model, section, member, property] of [",
        "    ['projections/model-bound/clearing/child', 'MbClearingTaskList', 'Children', 'tasks', 'due'],",
        "    ['projections/model-bound/clearing/nested-member', 'MbClearingEmployee', 'Nested', 'contract', 'noticeGiven'],",
        "    ['projections/model-bound/clearing/set-value-null', 'MbClearingInvoice', 'Root', '', 'reference'],",
        "    ['projections/model-bound/clearing/fluent', 'MbClearingFluentProjectProjection', 'Root', '', 'note'],",
        "    ['projections/model-bound/clearing/fluent', 'MbClearingFluentProjectProjection', 'Nested', 'summary', 'note'],",
        "    ['projections/model-bound/clearing/fluent', 'MbClearingFluentProjectProjection', 'Children', 'tasks', 'note'],",
        "]) {",
        "    const type = snippetClasses.find(([snippetPath, candidate]) => snippetPath === path && candidate.name === model)?.[1];",
        "    const definition = definitions.find(candidate => candidate.Identifier === type?.name);",
        "    const child = section === 'Root' ? definition : definition?.[section]?.[member];",
        "    const mapping = child?.From?.find(from => from.Value.Properties[property] === '$null');",
        "    if (!mapping || child.RemovedWith.some(removed => removed.Key.Id === mapping.Key.Id && removed.Key.Generation === mapping.Key.Generation)) {",
        "        throw new Error(`${path}: ${property} must map to $null, not RemovedWith.`);",
        "    }",
        "}",
        "// The working noAutoMap examples must disable automatic mapping on their child/nested definitions.",
        "for (const [path, model, section, member] of [",
        "    ['projections/model-bound/children/no-automap', 'MbChildrenNoAutoMapOrder', 'Children', 'items'],",
        "    ['projections/model-bound/nested/no-automap', 'SliceWithNestedCommandNoAutoMap', 'Nested', 'command'],",
        "]) {",
        "    const type = snippetClasses.find(([snippetPath, candidate]) => snippetPath === path && candidate.name === model)?.[1];",
        "    const definition = definitions.find(candidate => candidate.Identifier === type?.name);",
        "    if (!type || definition?.[section]?.[member]?.AutoMap !== 1) {",
        "        throw new Error(`${path}: ${section}.${member}.AutoMap must be Disabled (1).`);",
        "    }",
        "}",
        "console.log(`Standard decorators: ${definitions.length} projection definitions compiled.`);",
    ] if runtime else []
    return "\n\n".join([
        "// This file is generated by Documentation/validate-client-snippets.py.",
        *imports,
        *declarations,
        *functions,
        *schema_checks,
        "",
    ])


def generate_invalid_source(path: Path) -> str:
    snippet = extract_snippet(path)
    if snippet is None:
        raise ValueError(f"Expected an intentionally invalid TypeScript snippet in {path}")
    named_imports = {"getEventTypeMetadata"}
    contracts_named_imports: set[str] = set()
    fundamentals_named_imports: set[str] = set()
    side_effect_imports = {"reflect-metadata"}
    body = split_imports(snippet, named_imports, contracts_named_imports, fundamentals_named_imports, side_effect_imports)
    classes = CLASS_RE.findall(body)
    if not classes:
        raise ValueError(f"No classes found in intentionally invalid snippet {path}")
    imports = [
        *[f"import '{module_name}';" for module_name in sorted(side_effect_imports)],
        f"import {{ {', '.join(sorted(named_imports))} }} from '../sdk.mjs';",
    ]
    if contracts_named_imports:
        imports.append(f"import {{ {', '.join(sorted(contracts_named_imports))} }} from '@cratis/chronicle.contracts';")
    if fundamentals_named_imports:
        imports.append(f"import {{ {', '.join(sorted(fundamentals_named_imports))} }} from '@cratis/fundamentals';")
    return "\n\n".join([*imports, body, *[f"void getEventTypeMetadata({name})?.schema;" for name in classes], ""])


def generate_tsconfig(standard: bool, runtime: bool = False) -> str:
    config = {
        "extends": "../tsconfig.json",
        "compilerOptions": {
            "noEmit": not runtime,
            "noUnusedLocals": False,
            "noUnusedParameters": False,
            "experimentalDecorators": not standard,
            "emitDecoratorMetadata": not standard,
        },
        "include": ["snippets.ts"],
    }
    if runtime:
        # Already type-checked in both modes above; emit against the bundled SDK.
        config["compilerOptions"].update({"noCheck": True, "rootDir": ".", "outDir": "runtime"})
        config["include"].append("invalid-*.ts")
    return json.dumps(config, indent=4) + "\n"


def main() -> int:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_SOURCE.write_text(generate_source(), encoding="utf-8")
    files = [path for path in snippet_files() if extract_snippet(path) is not None]

    try:
        for standard in (False, True):
            GENERATED_TSCONFIG.write_text(generate_tsconfig(standard), encoding="utf-8")
            mode = "standard" if standard else "legacy"
            subprocess.run(["yarn", "exec", "tsc", "-p", ".docs-snippets/tsconfig.json"], cwd=SOURCE_ROOT, check=True)
            print(f"{mode.capitalize()} decorators: {len(files)} TypeScript snippets compiled.", flush=True)

        # Bundle the SDK separately; emit snippets with tsc so bundler renaming
        # cannot change constructor parameter names introspected by the SDK.
        GENERATED_SOURCE.write_text(generate_source(runtime=True), encoding="utf-8")
        invalid_files = {snippet_key(path): path for path in snippet_files() if snippet_key(path) in RUNTIME_INVALID_ERRORS}
        if invalid_files.keys() != RUNTIME_INVALID_ERRORS.keys():
            raise ValueError(f"Missing intentionally invalid snippets: {RUNTIME_INVALID_ERRORS.keys() - invalid_files.keys()}")
        invalid_cases = []
        for index, (key, path) in enumerate(sorted(invalid_files.items())):
            module = f"invalid-{index}"
            (GENERATED_DIR / f"{module}.ts").write_text(generate_invalid_source(path), encoding="utf-8")
            invalid_cases.append((key, RUNTIME_INVALID_ERRORS[key], module))
        GENERATED_INVALID_CHECK.write_text("const cases = " + json.dumps(invalid_cases) + ";\n" + textwrap.dedent("""
            for (const [path, expected, module] of cases) {
                try {
                    await import(`./runtime/${module}.js`);
                } catch (error) {
                    if (error?.name === expected) continue;
                    throw new Error(`${path}: expected ${expected}, got ${String(error)}`, { cause: error });
                }
                throw new Error(`${path}: expected ${expected}, but the snippet did not throw.`);
            }
            console.log(`Standard decorators: ${cases.length} intentionally invalid snippets rejected with expected errors.`);
        """), encoding="utf-8")
        GENERATED_SDK_ENTRY.write_text("export * from '../index.js';\nexport { hasModelBoundProperties } from '../types/TypeDiscoverer.js';\nexport { validateArtifactSchemas } from '../artifacts/validateArtifactSchemas.js';\nexport { ProjectionDefinitionCompiler } from '../projections/ProjectionDefinitionCompiler.js';\nexport { isModelBoundProjection } from '../projections/modelBound/isModelBoundProjection.js';\nexport { rootReadModelTypes } from '../readModels/rootReadModelTypes.js';\n", encoding="utf-8")
        subprocess.run([
            "yarn", "exec", "esbuild", ".docs-snippets/sdk-entry.ts", "--bundle", "--packages=external",
            "--platform=node", "--format=esm", "--target=es2022", "--outfile=.docs-snippets/sdk.mjs",
        ], cwd=SOURCE_ROOT, check=True)
        GENERATED_TSCONFIG.write_text(generate_tsconfig(True, runtime=True), encoding="utf-8")
        subprocess.run(["yarn", "exec", "tsc", "-p", ".docs-snippets/tsconfig.json"], cwd=SOURCE_ROOT, check=True)
        subprocess.run(["node", ".docs-snippets/runtime/snippets.js"], cwd=SOURCE_ROOT, check=True)
        subprocess.run(["node", ".docs-snippets/invalid-check.mjs"], cwd=SOURCE_ROOT, check=True)
    finally:
        shutil.rmtree(GENERATED_DIR, ignore_errors=True)

    print("TypeScript Chronicle client snippets validated successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Client snippet validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
