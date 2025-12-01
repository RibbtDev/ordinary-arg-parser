# ordinary-arg-parser

A lightweight GNU-convention compliant command-line argument parser.

```typescript
// CommonJS
const { ordinaryArgParser } = require("ordinary-arg-parser");

// ES Module / Browser
import { ordinaryArgParser } from "ordinary-arg-parser";

const result = ordinaryArgParser(
  ['-am', 'Initial commit', '--author=John', '--no-verify', 'file.js'],
  [
    { name: 'all', kind: 'flag', alias: 'a' },
    { name: 'message', kind: 'value', alias: 'm', default: '' },
    { name: 'verify', kind: 'flag', default: true },
    { name: 'author', kind: 'value', default: '' }
  ]
);

// {
//   _: ['file.js'],
//   all: true,
//   message: 'Initial commit',
//   verify: false,
//   author: 'John'
// }
```

## API

`ordinaryArgParser(args, config)`

Parameters:
- `args: string[]` — Array of argument strings (typically `process.argv.slice(2)`)
- `config: OptionsConfig` — Array of option definitions

Returns:
`ParseResult` — Object with parsed options and positional arguments in `_`

Throws:
`UnknownArgumentError` or `MissingValueError` when invalid arguments are encountered.

**Option Configuration**
```typescript
interface OptionConfig {
  kind: 'flag' | 'value';
  name: string;                                      // Canonical long name
  alias?: string;                                    // Single-character short name
  default?: unknown;                                 // Required for 'value' kind
  duplicateHandling?: 'accumulate' | 'last-wins' | 'first-wins';
  transform?: (value: unknown) => unknown;           // Applied after parsing
}
```

**Supported Formats:**

| Format | Example | Description |
|--------|---------|-------------|
| Short flag | `-v` | Boolean flag |
| Long flag | `--verbose` | Boolean flag |
| Short clustered | `-abc` | Multiple flags: `-a -b -c` |
| Short with value | `-o file.txt` | Space-separated |
| Short attached | `-ofile.txt` | Value attached |
| Long with equals | `--output=file.txt` | Equals syntax |
| Long with space | `--output file.txt` | Space-separated |
| Negation | `--no-verify` | Sets flag to false |
| Terminator | `--` | End options, rest positional |


Numbers (including negative and floats) are treated as values, not options:
- `--count 10` → value is `'10'`
- `--offset -5` → value is `'-5'` (not an option)
- `--ratio=-2.5` → value is `'-2.5'`

**Duplicate Handling Strategies:**
- `'last-wins'` (default): `--output a.txt --output b.txt` → `output: 'b.txt'`
- `'first-wins'`: `--output a.txt --output b.txt` → `output: 'a.txt'`
- `'accumulate'`: `--exclude a --exclude b` → `exclude: ['a', 'b']`

**Transforms:**

Applied to both parsed values and defaults. If transform throws, wrap parser in try-catch.

**Result Structure:**

Options stored by `name` (never by `alias`), positionals in `_` array

## Error Handling

The ordinary-arg-parser throws errors with a `code` property for quick identification and a `toJSON()` method for logging.

**UnknownArgumentError** (`code: 'UNKNOWN_ARGUMENT'`) - thrown when an argument isn't defined in your configuration. Includes properties: `argument`, `rawArgs`.

**MissingValueError** (`code: 'MISSING_VALUE'`) - thrown when an argument with `kind: 'value'` doesn't receive a value. Includes properties: `argument`, `rawArgs`.

```typescript
try {
  const args = ordinaryArgParser(process.argv.slice(2), config);
  // Use parsed args...
} catch (error) {
  if (error.code === 'UNKNOWN_ARGUMENT') {
    console.error(`Error: Unknown option '${error.argument}'`);
    console.error('Run with --help to see available options.');
  }
  
  if (error.code === 'MISSING_VALUE') {
    console.error(`Error: ${error.argument} requires a value`);
    console.error(`Example: mytool ${error.argument} <value>`);
  }
  
  // Log structured error data to your telemetry system
  logger.error('Argument parsing failed', error.toJSON());
  process.exit(1);
}
```

## Limitations
Clustering: Only the last option in a cluster can take a value: `-abc value` gives value to `c`.

No Built-in Validation: The parser doesn't validate required options, value constraints, or option relationships. Handle this in your application logic.

## Further Reading

The ordinary-arg-parser implements GNU-style command-line argument parsing conventions. To understand the standards and design principles behind these conventions, check these references:

- **POSIX** defines the core: short options (`-v`), option arguments, and `--` terminator
- **GNU** extends with: long options (`--verbose`), equals syntax (`--output=file`), and negation (`--no-verify`)
- **This library** implements GNU conventions, which are a superset of POSIX and match user expectations from tools like `git`, `tar`, and `grep`


1. [The foundational specification for command-line argument syntax in Unix-like systems](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html).
2. [GNU's extension and refinement of POSIX conventions](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html), including long options and the `--no-` prefix.
3. [Technical documentation on GNU's argument parsing conventions](https://www.gnu.org/software/libc/manual/html_node/Argument-Syntax.html) with detailed examples.

## License

MIT
