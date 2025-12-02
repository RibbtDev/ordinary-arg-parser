# ordinary-arg-parser

A lightweight command-line argument parser for Node.js and browsers. It follows GNU conventions.

## Quick Start

### Installation

```bash
npm install ordinary-arg-parser
```

### Try It Out

```typescript
// CommonJS
const { ordinaryArgParser } = require("ordinary-arg-parser");

// ES Module / Browser
import { ordinaryArgParser } from "ordinary-arg-parser";

const result = ordinaryArgParser(
    // Node.js - value of `process.argv.slice(2)`
    // Browser - Command-line input string split on whitespaces
    ['-am', 'Initial commit', '--author=John', '--no-verify', 'file.js'],
    [
        { name: 'all', kind: 'flag', alias: 'a' },
        { name: 'message', kind: 'value', alias: 'm', default: '' },
        { name: 'verify', kind: 'flag', default: true },
        { name: 'author', kind: 'value', default: '' }
    ]
);

// Returns
{
    _: ['file.js'],
    all: true,
    message: 'Initial commit',
    verify: false,
    author: 'John'
}
```

## Usage

#### `ordinaryArgParser(args, config)`

Parameters:

- `args: string[]` — An array of argument strings to parse. This is typically `process.argv.slice(2)` in Node.js app.
- `config: OptionsConfig` — An array of option definitions that describe the expected arguments and their behavior.

Returns:
`ParseResult` — An object containing the parsing results. Options are stored by their `name` (never by `alias`), and positional arguments are stored in `_`.

Throws:
The parser throws `UnknownArgumentError` or `MissingValueError` when it encounters invalid arguments.

#### Option Configuration

```typescript
interface OptionConfig {
    kind: "flag" | "value";
    name: string; // Canonical long name
    alias?: string; // Single-character short name
    default?: unknown; // Required for 'value' kind
    duplicateHandling?: "accumulate" | "last-wins" | "first-wins";
    transform?: (value: unknown) => unknown; // Applied after parsing
}
```

Each option in your configuration must specify whether it's a `flag` (boolean) or expects a `value`.

#### Supported Option Formats

The parser recognizes standard GNU-style argument patterns:

| Format           | Example             | Description                  |
| ---------------- | ------------------- | ---------------------------- |
| Short flag       | `-v`                | Boolean flag                 |
| Long flag        | `--verbose`         | Boolean flag                 |
| Short clustered  | `-abc`              | Multiple flags: `-a -b -c`   |
| Short with value | `-o file.txt`       | Space-separated              |
| Short attached   | `-ofile.txt`        | Value attached               |
| Long with equals | `--output=file.txt` | Equals syntax                |
| Long with space  | `--output file.txt` | Space-separated              |
| Negation         | `--no-verify`       | Sets flag to false           |
| Terminator       | `--`                | End options, rest positional |

#### Numeric Values

Numbers are always treated as values, never as options. This includes negative numbers and floating-point values. For example, `--count 10` produces a value of `'10'`, and `--offset -5` produces `'-5'`.

#### Duplicate Handling

When an option appears multiple times, you can control the behavior through the `duplicateHandling` property. The default strategy is `'last-wins'`, where `--output a.txt --output b.txt` results in `output: 'b.txt'`. The `'first-wins'` strategy does the opposite, keeping `'a.txt'`. The `'accumulate'` strategy collects all values into an array, so `--exclude a --exclude b` produces `exclude: ['a', 'b']`.

#### Transforms

The `transform` function is applied to both parsed values and defaults. This allows you to convert strings to numbers, validate inputs, or perform any other post-processing.

## Error Handling

The ordinary-arg-parser throws errors with a `code` property and a `toJSON()` method for logging.

**UnknownArgumentError** (`code: 'UNKNOWN_ARGUMENT'`) is thrown when an argument isn't defined in your configuration. The error includes the problematic `argument` and the full `rawArgs` array for context.

**MissingValueError** (`code: 'MISSING_VALUE'`) is thrown when an argument with `kind: 'value'` doesn't receive a value. Like the unknown argument error, it includes both the `argument` and `rawArgs` properties.

```typescript
try {
    const args = ordinaryArgParser(process.argv.slice(2), config);
    // Use parsed args...
} catch (error) {
    if (error.code === "UNKNOWN_ARGUMENT") {
        console.error(`Error: Unknown option '${error.argument}'`);
        console.error("Run with --help to see available options.");
    }

    if (error.code === "MISSING_VALUE") {
        console.error(`Error: ${error.argument} requires a value`);
        console.error(`Example: mytool ${error.argument} <value>`);
    }

    // Log structured error data to your telemetry system
    logger.error("Argument parsing failed", error.toJSON());
    process.exit(1);
}
```

## Limitations

The parser has intentional constraints that keep it lightweight and focused.

When clustering short options like `-abc value`, only the last option in the cluster can receive a value, so the value is assigned to `c`.

The parser also doesn't include built-in validation for required options, value constraints, or relationships between options. You should handle these requirements in your application logic after parsing.

## Further Reading

- **[POSIX](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html)** defines the core: short options (`-v`), option arguments, and `--` terminator
- **[GNU](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html)** extends with: long options (`--verbose`), equals syntax (`--output=file`), and negation (`--no-verify`)

## License

MIT
