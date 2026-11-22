// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace ProjectionOracle;

internal static class RequiredFixtures
{
    static readonly string[] Events =
    [
        "constraints.json", "constraints-isolation.json", "constraints-key-domain.json", "constraints-property-lifecycle.json",
        "constraints-property-covered-removal.json", "constraints-event-type-cycles.json", "constraints-event-type-siblings.json",
        "constraints-composite.json", "constraints-ignore-casing.json", "constraints-scopes.json", "constraints-field-types.json",
        "constraints-event-sequences.json", "constraints-field-combinations.json", "constraints-field-key-measurements.json",
        "constraints-ignore-casing-measurements.json"
    ];

    static readonly string[] Projections =
    [
        "joins-lifecycle.json", "joins-missing-values.json", "joins-automap.json", "joins-automap-enabled.json",
        "joins-children-fluent.json", "joins-children-legacy.json", "joins-children-standard.json",
        "joins-automap-disabled.json", "joins-root-key-collision.json", "joins-custom-key.json", "joins-initial-state.json", "joins-unrelated-root-update.json",
        "children-typed-items.json", "children-untyped-items.json", "children-identifier-equals-key.json",
        "context-child-keys-fluent.json", "context-child-keys-legacy.json", "context-child-keys-standard.json",
        "count-children-root-first.json", "count-children-child-first.json",
        "add-children-lifecycle.json", "add-children-same-property.json", "add-children-leading-underscore.json",
        "subtract-children-lifecycle.json", "subtract-children-same-property.json", "subtract-children-leading-underscore.json",
        "subtract-children-legacy.json", "subtract-children-standard.json",
        "increment-children-fluent.json", "increment-children-legacy.json", "increment-children-standard.json",
        "decrement-children-fluent.json", "decrement-children-legacy.json", "decrement-children-standard.json",
        "arithmetic.json", "aggregate-only-automap.json", "rounded-integer-operand.json", "int32-overflow.json", "null-accumulator.json",
        "arithmetic-numeric-matrix.json", "arithmetic-initial-and-large.json", "arithmetic-integer-boundaries.json",
        "arithmetic-rounding.json", "arithmetic-automap.json", "arithmetic-string-operand.json",
        "arithmetic-nonnumeric-operand.json", "arithmetic-uint32-overflow.json", "arithmetic-null-initial.json",
        "arithmetic-int32-operand-overflow.json", "arithmetic-uint32-operand.json", "arithmetic-unformatted-number.json",
        "arithmetic-remove-recreate.json", "arithmetic-zero-operand.json", "arithmetic-assignment.json",
        "from-all-only.json", "from-all-mixed.json", "from-all-exclude-children.json", "from-all-empty.json", "from-every-restricted.json",
        "composite-key-expression-parts.json", "composite-parent-key-expression-parts.json", "composite-join-key-expression-parts.json",
        "composite-parent-key-without-constant.json", "composite-child-join-key-expression-parts.json",
        "composite-child-creation-fluent.json", "composite-child-creation-legacy.json", "composite-child-creation-standard.json"
    ];

    internal static void Validate(string[] eventFiles, string[] projectionFiles, bool eventsOnly)
    {
        Require(eventFiles, Events, Path.Combine("Source", "testing", "fixtures"), "Event");
        if (eventFiles.Length < 4)
        {
            throw new InvalidOperationException("Event oracle requires at least four fixtures; refusing a vacuous check.");
        }
        if (eventsOnly) return;
        Require(projectionFiles, Projections, Path.Combine("Source", "testing", "projections", "fixtures"), "Projection");
        if (projectionFiles.Length < 5)
        {
            throw new InvalidOperationException("Projection oracle requires at least five fixtures; refusing a vacuous check.");
        }
    }

    static void Require(string[] files, string[] required, string directory, string kind)
    {
        foreach (var name in required)
        {
            if (!files.Contains(Path.Combine(directory, name)))
                throw new InvalidOperationException($"{kind} oracle requires {name}; refusing a vacuous check.");
        }
    }
}
