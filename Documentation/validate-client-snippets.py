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
GENERATED_TSCONFIG = GENERATED_DIR / "tsconfig.json"
FENCE_RE = re.compile(r"```([^\s`]+)[^\n]*\n(.*?)\n```", re.DOTALL)
NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/chronicle['\"];?\s*$")
CONTRACTS_NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/chronicle\.contracts['\"];?\s*$")
FUNDAMENTALS_NAMED_IMPORT_RE = re.compile(r"^import\s+\{([^}]+)\}\s+from\s+['\"]@cratis/fundamentals['\"];?\s*$")
SIDE_EFFECT_IMPORT_RE = re.compile(r"^import\s+['\"]([^'\"]+)['\"];?\s*$")
UNSUPPORTED_SNIPPET_MARKER = "does not support this workflow yet"
VALIDATION_EXCLUDED_PREFIXES = ("legacy/",)

BODY_SNIPPETS = {
    "get-started/client-flow": "",
    "events/appending/schema-validation": """
        const eventSourceId = 'order-123';
        const customerId = 'customer-42';
        const total = 42;
    """,
    "read-models/getting-single-instance/basic": """
        const accountId = 'account-42';
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


def generate_source() -> str:
    files = snippet_files()
    if not files:
        raise ValueError(f"No client snippets found in {SNIPPET_ROOT}")

    named_imports = {"IEventStore"}
    contracts_named_imports: set[str] = set()
    fundamentals_named_imports: set[str] = set()
    side_effect_imports = {"reflect-metadata"}
    declarations: list[str] = [textwrap.dedent(declaration).strip() for declaration in COMMON_DECLARATIONS]
    functions: list[str] = []

    for path in files:
        relative_path = snippet_key(path)
        snippet = extract_snippet(path)
        if snippet is None:
            continue

        body = split_imports(snippet, named_imports, contracts_named_imports, fundamentals_named_imports, side_effect_imports)

        if relative_path in BODY_SNIPPETS:
            prelude = textwrap.dedent(BODY_SNIPPETS[relative_path]).strip()
            lines = [line for line in [prelude, body] if line]
            function_body = textwrap.indent("\n\n".join(lines), "    ")
            functions.append(f"async function {function_name(relative_path)}(store: IEventStore): Promise<void> {{\n{function_body}\n}}")
        else:
            declarations.append(body)

    imports = [
        *[f"import '{module_name}';" for module_name in sorted(side_effect_imports)],
        f"import {{ {', '.join(sorted(named_imports))} }} from '../index';",
    ]
    if contracts_named_imports:
        imports.append(f"import {{ {', '.join(sorted(contracts_named_imports))} }} from '@cratis/chronicle.contracts';")
    if fundamentals_named_imports:
        imports.append(f"import {{ {', '.join(sorted(fundamentals_named_imports))} }} from '@cratis/fundamentals';")

    return "\n\n".join([
        "// This file is generated by Documentation/validate-client-snippets.py.",
        *imports,
        *declarations,
        *functions,
        "",
    ])


def generate_tsconfig() -> str:
    config = {
        "extends": "../tsconfig.json",
        "compilerOptions": {
            "noEmit": True,
            "noUnusedLocals": False,
            "noUnusedParameters": False,
        },
        "include": ["snippets.ts"],
    }
    return json.dumps(config, indent=4) + "\n"


def main() -> int:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_SOURCE.write_text(generate_source(), encoding="utf-8")
    GENERATED_TSCONFIG.write_text(generate_tsconfig(), encoding="utf-8")

    try:
        subprocess.run(["yarn", "exec", "tsc", "-p", ".docs-snippets/tsconfig.json"], cwd=SOURCE_ROOT, check=True)
    finally:
        shutil.rmtree(GENERATED_DIR, ignore_errors=True)

    print("TypeScript Chronicle client snippets compiled successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Client snippet validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
