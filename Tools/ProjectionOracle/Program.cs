// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectionOracle;

internal static class Program
{
    const string ChronicleVersion = "19.8.1";
    const string ChronicleCommit = "8fe5d30";
    const string ContractsVersion = "19.6.1";

    static async Task<int> Main(string[] args)
    {
        try
        {
            ProjectionDefinitionBridge.SmokeTest();
            Console.WriteLine($"Chronicle {ChronicleVersion} converter signature: OK");
            if (args is ["--smoke"]) return 0;
            if (args is not ["--check"] and not ["--update"])
            {
                Console.Error.WriteLine("Usage: ProjectionOracle --smoke | --check | --update (run from the repository root)");
                return 2;
            }
            var descriptor = Path.Combine("node_modules", "@cratis", "chronicle.contracts", "generated", "projections.ts");
            if (!File.Exists(descriptor)) throw new FileNotFoundException("Install pinned Yarn dependencies before checking the contracts descriptor.", descriptor);
            var hash = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(descriptor)));
            var files = Directory.GetFiles(Path.Combine("Source", "testing", "projections", "fixtures"), "*.json").OrderBy(name => name, StringComparer.Ordinal).ToArray();
            if (files.Length < 5) throw new InvalidOperationException("Oracle requires at least five fixtures; refusing a vacuous check.");
            var drift = 0;
            foreach (var path in files)
            {
                var fixture = JsonNode.Parse(await File.ReadAllTextAsync(path))!.AsObject();
                if (fixture["formatVersion"]?.GetValue<int>() != 1 || fixture["chronicle"]?["version"]?.GetValue<string>() != ChronicleVersion ||
                    fixture["chronicle"]?["commit"]?.GetValue<string>() != ChronicleCommit ||
                    fixture["tsContracts"]?["version"]?.GetValue<string>() != ContractsVersion ||
                    fixture["tsContracts"]?["descriptorSha256"]?.GetValue<string>() != hash)
                {
                    throw new InvalidOperationException($"{path}: fixture version/hash does not match pinned engine and TypeScript contract descriptor.");
                }
                var actual = await OracleRunner.Run(fixture);
                if (args[0] == "--update")
                {
                    fixture["expected"] = actual;
                    await File.WriteAllTextAsync(path, fixture.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
                }
                else if (!JsonNode.DeepEquals(fixture["expected"], actual))
                {
                    Console.Error.WriteLine($"{path}: drift\nexpected: {fixture["expected"]?.ToJsonString()}\nactual:   {actual.ToJsonString()}");
                    drift++;
                }
                else Console.WriteLine($"{path}: OK");
            }
            if (drift != 0) throw new InvalidOperationException($"{drift} oracle fixture(s) drifted; review production semantics before regenerating expectations.");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }
}
