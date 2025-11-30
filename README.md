# ordinary-arg-parser

A lightweight GNU-convention compliant command-line argument parser. This library is a **parsing primitive** that extracts structure from argument strings.

## Quick Usage
```typescript
import ordinaryArgParser from 'ordinary-arg-parser';

// Git-like commit command demonstrating core features
const result = ordinaryArgParser(
  [
    '-am', 'Initial commit',           // -a and -m clustered: short option with value
    '--author=John Doe',                // Long option with equals syntax
    '--no-verify',                      // GNU-style negation
    '-v', '-v',                         // Repeated flags (accumulates to array)
    '--exclude', '*.log',               // Variadic option
    '--exclude', '*.tmp',               // Multiple values accumulate
    '--threads', '8',                   // Numeric value (parsed as string)
    '--offset=-2.5',                    // Negative float (not treated as option)
    'file1.js',                         // Positional argument
    '--',                               // Terminator: everything after is positional
    'file2.js',                         
    '--not-an-option'                   // Treated as positional after --
  ],
  [
    // Flag option with alias
    { name: 'all', kind: 'flag', alias: 'a' },
    
    // Value option with alias and default
    { name: 'message', kind: 'value', alias: 'm', default: '' },
    
    // Flag with accumulate (for verbosity levels)
    { 
      name: 'verbose', 
      kind: 'flag', 
      alias: 'v',
      duplicateHandling: 'accumulate'
    },
    
    // Flag with default true (negatable with --no-verify)
    { name: 'verify', kind: 'flag', default: true },
    
    // Long option only (no alias)
    { name: 'author', kind: 'value', default: '' },
    
    // Variadic option: accumulates multiple values
    { 
      name: 'exclude', 
      kind: 'value', 
      default: [],
      duplicateHandling: 'accumulate'
    },
    
    // Transform string to number
    { 
      name: 'threads', 
      kind: 'value', 
      default: '1',
      transform: (v) => parseInt(v as string, 10)
    },
    
    // Transform string to float
    { 
      name: 'offset', 
      kind: 'value', 
      default: '0',
      transform: (v) => parseFloat(v as string)
    }
  ]
);

console.log(result);
// {
//   _: ['file1.js', 'file2.js', '--not-an-option'],  // Positionals
//   all: true,                                         // From -a
//   message: 'Initial commit',                         // From -m
//   verbose: [true, true],                             // Accumulated from -v -v
//   verify: false,                                     // Negated by --no-verify
//   author: 'John Doe',                                // From --author=
//   exclude: ['*.log', '*.tmp'],                       // Accumulated array
//   threads: 8,                                        // Transformed to number
//   offset: -2.5                                       // Transformed to float
// }
```

## API

### `ordinaryArgParser(args, config)`

Parses command-line arguments according to GNU conventions.

**Parameters:**

- `args: string[]` — Array of argument strings (typically `process.argv.slice(2)`)
- `config: OptionsConfig` — Array of option definitions

**Returns:** `ParseResult` — Object with parsed options and positional arguments in `_`

**TypeScript Types:**
```typescript
interface ParseResult {
  _: string[];           // Positional arguments
  [k: string]: unknown;  // Parsed options by canonical name
}

type DuplicateHandling = 'accumulate' | 'last-wins' | 'first-wins';

interface NoneOptionConfig {
  kind: 'flag';
  name: string;                                      // Canonical long name
  alias?: string;                                    // Single-character short name
  default?: unknown;                                 // Optional for flags
  duplicateHandling?: DuplicateHandling;             // Default: 'last-wins'
  transform?: (value: unknown) => unknown;           // Applied after parsing
}

interface ValueOptionConfig {
  kind: 'value';
  name: string;
  alias?: string;
  default: unknown;                                  // Required for value options
  duplicateHandling?: DuplicateHandling;
  transform?: (value: unknown) => unknown;
}

type OptionConfig = NoneOptionConfig | ValueOptionConfig;
type OptionsConfig = OptionConfig[];
```

**Option Formats Recognized:**

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

**Numeric Handling:**

Numbers (including negative and floats) are treated as values, not options:
- `--count 10` → value is `'10'`
- `--offset -5` → value is `'-5'` (not an option)
- `--ratio=-2.5` → value is `'-2.5'`

**Duplicate Handling Strategies:**

- `'last-wins'` (default): `--output a.txt --output b.txt` → `output: 'b.txt'`
- `'first-wins'`: `--output a.txt --output b.txt` → `output: 'a.txt'`
- `'accumulate'`: `--exclude a --exclude b` → `exclude: ['a', 'b']`

**Transforms:**

Applied to both parsed values and defaults. If transform throws, parsing fails.

**Result Structure:**

- Options stored by canonical `name`, never by `alias`
- Positional arguments in `_` array (includes everything after `--`)
- All configured options present (from parsing or defaults)

## Limitations

### Unknown Options Are Ignored

Unknown options are silently ignored (error handling pending):
```typescript
ordinaryArgParser(['--typo', '--verbose'], config);
// Result: { _: [], verbose: true }  // --typo silently ignored
```

### No Built-in Validation

The parser doesn't validate:
- Required options
- Valid values (enums, ranges)
- Mutually exclusive options
- Dependent options

### Clustering Limitations

Only the first option with kind='value' in a cluster can take a value:
```typescript
'-abc value'    // option c gets 'value'
'-abcvalue'     // option c gets 'value'
'-abcd=value'   // option c gets 'd' not 'value'
```

### No Configuration Validation

The parser doesn't check for:
- Duplicate option names (Last one wins)
- Duplicate aliases
- Multi-character aliases
- Empty names

### Transform Errors Propagate

If a transform function throws, wrap parser in try-catch.

### Shell Expansion Happens First

Globs, quotes, and variables are expanded by the shell before your program sees them:
```bash
node app.js *.txt        # Shell expands to: node app.js file1.txt file2.txt
node app.js "a b"        # Shell passes as single arg: "a b"
node app.js $VAR         # Shell expands variable first
```

This is standard behavior, not a limitation. If you need glob patterns, use a library like `glob`.

### Interleaved Options and Operands

GNU conventions allow mixing, which mostly works:
```typescript
'file1.txt --verbose file2.txt'  // Works
```

For guaranteed predictable behavior, place all options before operands.

## Further Reading

The ordinary-arg-parser implements GNU-style command-line argument parsing conventions. To understand the standards and design principles behind these conventions, consult these authoritative references:

### Standards and Specifications

- **POSIX** defines the core: short options (`-v`), option arguments, and `--` terminator
- **GNU** extends with: long options (`--verbose`), equals syntax (`--output=file`), and negation (`--no-verify`)
- **This library** implements GNU conventions, which are a superset of POSIX and match user expectations from tools like `git`, `tar`, and `grep`

**POSIX Utility Conventions**  
[The foundational specification for command-line argument syntax in Unix-like systems](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html).  

This defines the baseline conventions that most Unix utilities follow, including option prefixes, argument syntax, and the `--` terminator.

**GNU Coding Standards: Command-Line Interfaces**  
[GNU's extension and refinement of POSIX conventions](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html), including long options and the `--no-` prefix.

Essential reading for understanding why GNU tools behave the way they do and what conventions users expect.

**GNU C Library: Argument Syntax Conventions**  
[Technical documentation on GNU's argument parsing conventions](https://www.gnu.org/software/libc/manual/html_node/Argument-Syntax.html) with detailed examples.

Covers the practical implementation details that this library follows, including option clustering, value attachment, and numeric handling.

## License

MIT

---
