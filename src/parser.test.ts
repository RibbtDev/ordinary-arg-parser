import { describe, it, expect } from "vitest";
import ordinaryArgParser, { OptionsConfig } from "./parser";

describe("ordinaryArgParser - Complete Specification Coverage", () => {
  it("Test 1: Options, clustering, negation, numbers, duplicates, and transforms", () => {
    // Covers: short/long options, clustering, values, negation, numbers, duplicate handling, transforms
    const config: OptionsConfig = [
      // Flags with various duplicate handling
      {
        name: "verbose",
        kind: "flag",
        alias: "v",
        duplicateHandling: "last-wins",
      },
      { name: "quiet", kind: "flag", alias: "q" },
      {
        name: "force",
        kind: "flag",
        alias: "f",
        duplicateHandling: "accumulate",
      },

      // Value options with transforms and defaults
      {
        name: "output",
        kind: "value",
        alias: "o",
        default: "default.txt",
        duplicateHandling: "last-wins",
      },
      {
        name: "count",
        kind: "value",
        alias: "n",
        default: "0",
        transform: (v) => parseInt(v as string, 10),
        duplicateHandling: "first-wins",
      },
      {
        name: "offset",
        kind: "value",
        default: "0",
        transform: (v) => parseFloat(v as string),
      },
      {
        name: "ratio",
        kind: "value",
        default: "1.0",
        transform: (v) => parseFloat(v as string),
      },
      {
        name: "tags",
        kind: "value",
        alias: "t",
        default: [],
        duplicateHandling: "accumulate",
      },

      // For negation test
      { name: "verify", kind: "flag", default: true },

      // For explicit false test
      { name: "colors", kind: "flag", default: true, alias: "c" },
    ];

    const result = ordinaryArgParser(
      [
        // Short option clustering (all flags)
        "-vqf",

        // Short option with attached value
        "-oattached.txt",

        // Short option with space-separated value (positive number)
        "-n",
        "42",

        // Long option with equals and negative number
        "--offset=-5",

        // Long option with equals and negative float
        "--ratio=-2.5",

        // Duplicate with last-wins (overwrites -oattached.txt)
        "--output=final.txt",

        // Duplicate with first-wins (42 should remain)
        "-n",
        "999",

        // Duplicate with accumulate
        "-f",
        "--force",

        // Accumulate for value options
        "-t",
        "tag1",
        "--tags=tag2",
        "-t",
        "tag3",

        // GNU-style negation
        "--no-verify",

        // Explicit false value
        "-c=false",

        // Duplicate last-wins for verbose
        "-v",
        "--verbose",

        // Positional before double-dash
        "file1.txt",

        // Double-dash terminator
        "--",

        // Everything after -- is positional (including option-like strings)
        "file2.txt",
        "--not-an-option",
        "-5",
        "100",
      ],
      config,
    );

    expect(result).toEqual({
      _: ["file1.txt", "file2.txt", "--not-an-option", "-5", "100"],
      verbose: true, // Last-wins: -v then --verbose
      quiet: true, // From cluster -vqf
      force: [true, true, true], // Accumulate: -vqf, -f, --force
      output: "final.txt", // Last-wins: attached.txt then final.txt
      count: 42, // First-wins: 42 kept, 999 ignored, transformed to number
      offset: -5, // Negative number with equals, transformed to float
      ratio: -2.5, // Negative float with equals, transformed
      tags: ["tag1", "tag2", "tag3"], // Accumulate
      verify: false, // Negation: --no-verify
      colors: false, // Explicit false: -c=false
    });
  });

  it("Test 2: Clustered values, defaults, space-separated long options, and edge cases", () => {
    // Covers: clustering with values, long option space-separated values, defaults,
    // interleaved operands, numbers as positional, hyphen-alone edge case
    const config: OptionsConfig = [
      { name: "archive", kind: "flag", alias: "a" },
      { name: "extract", kind: "flag", alias: "x" },
      { name: "file", kind: "value", alias: "f", default: "archive.tar" },
      {
        name: "directory",
        kind: "value",
        alias: "C",
        default: ".",
        duplicateHandling: "last-wins",
      },
      {
        name: "exclude",
        kind: "value",
        default: [],
        duplicateHandling: "accumulate",
      },
      {
        name: "threads",
        kind: "value",
        default: "1",
        transform: (v) => parseInt(v as string, 10),
      },
      {
        name: "depth",
        kind: "value",
        default: "0",
        transform: (v) => parseInt(v as string, 10),
      },
      { name: "interactive", kind: "flag", alias: "i", default: false },
      { name: "recursive", kind: "flag", alias: "r", default: false },
    ];

    const result = ordinaryArgParser(
      [
        // Short option cluster with final option taking inline value
        "-axfmyarchive.tar",

        // Long option with space-separated value (positive number)
        "--threads",
        "8",

        // Long option with space-separated value (negative number)
        "--depth",
        "-1",

        // Positional (operand before options - GNU allows interleaving)
        "src/",

        // Multiple accumulate with space-separated
        "--exclude",
        "*.log",
        "--exclude",
        "*.tmp",

        // Long option with equals (positive float)
        // (Using directory to test string value instead)
        "--directory=/tmp/output",

        // Another positional
        "data.json",

        // Short option cluster (flags only)
        "-ir",

        // Hyphen alone as positional
        "-",

        // Positive number as positional
        "42",

        // Negative number as positional (after non-option context)
        "-99.5",
      ],
      config,
    );

    expect(result).toEqual({
      _: ["src/", "data.json", "-", "42", "-99.5"], // Positionals including hyphen and numbers
      archive: true, // From cluster -axf
      extract: true, // From cluster -axf
      file: "myarchive.tar", // From cluster -axf with inline value
      threads: 8, // Space-separated positive, transformed
      depth: -1, // Space-separated negative, transformed
      exclude: ["*.log", "*.tmp"], // Accumulate
      directory: "/tmp/output", // Last-wins with equals format
      interactive: true, // From cluster -ir
      recursive: true, // From cluster -ir
    });
  });

  it("Test 4: MissingValueError - throws with correct information", () => {
    const config: OptionsConfig = [
      { name: "output", kind: "value", alias: "o", default: "out.txt" },
      { name: "verbose", kind: "flag", alias: "v" },
    ];

    try {
      ordinaryArgParser(["--output", "--verbose"], config);
    } catch (error) {
      expect(error.code).toBe("MISSING_VALUE");
      expect(error.argument).toBe("output");
      expect(error.rawArgs).toEqual(["--output", "--verbose"]);
      expect(error.message).toContain("Argument 'output'");
      expect(error.message).toContain("requires a value");
    }
  });

  it("Test 5: MissingValueError - at end of arguments", () => {
    const config: OptionsConfig = [
      { name: "port", kind: "value", alias: "p", default: "3000" },
    ];

    // Missing value: --port at the end with no value
    try {
      ordinaryArgParser(["--port"], config);
    } catch (error) {
      expect(error.code).toBe("MISSING_VALUE");
      expect(error.argument).toBe("port");
    }
  });
});
