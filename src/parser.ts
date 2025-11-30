export interface ParseResult {
  _: string[];
  [k: string]: unknown;
}

type DuplicateHandling = "accumulate" | "last-wins" | "first-wins";

interface BaseOptionConfig {
  name: string;
  alias?: string; // short name, single character
  duplicateHandling?: DuplicateHandling;
  transform?: (value: unknown) => unknown;
}

// Flags: no value, default is optional (often boolean)
interface NoneOptionConfig extends BaseOptionConfig {
  kind: "flag";
  default?: unknown;
}

// Value options: must have a default
interface ValueOptionConfig extends BaseOptionConfig {
  kind: "value";
  default: unknown; // REQUIRED when kind === 'value'
}

export type OptionConfig = NoneOptionConfig | ValueOptionConfig;
export type OptionsConfig = OptionConfig[];
type ConfigMap = Map<string, OptionConfig>;
type AliasMap = Map<string, string>;

function isNumericRegex(str: string) {
  return /^-?\d+(\.\d+)?$/.test(str);
}

// Strip leading "-" or "--" and return count + remainder.
function stripHyphens(arg: string) {
  const hyphenCount = [...arg].findIndex((a) => a !== "-");
  const content = arg.slice(hyphenCount);

  return { hyphenCount, content };
}

// Treat "-" as positional (matches common GNU tooling).
// Any other string starting with "-" is considered an option candidate.
// Negative numbers are treated as values
function isOptionArg(arg: string) {
  if (arg.length < 2) {
    return false;
  }

  return arg.startsWith("-") && !isNumericRegex(arg);
}

// Split "foo=bar" into ("foo", "bar"), or ("foo", undefined) if no "=".
function parseEqualsFormat(arg: string) {
  const equalIndex = arg.indexOf("=");

  if (equalIndex === -1) {
    return { rawOption: arg, inlineValue: undefined };
  }

  const rawOption = arg.slice(0, equalIndex);
  const inlineValue = arg.slice(equalIndex + 1);

  return { rawOption, inlineValue };
}

// For short options, expand "abc" to ['a', 'b', 'c'].
function expandShortCluster(option: string) {
  return option.split("");
}

// GNU-style negative long options: "--no-foo"
function isNegativeOption(option: string) {
  return option.startsWith("no-");
}

function extractNegativeOption(option: string) {
  return option.slice(3); // drop "no-"
}

function isNextArgValue(args: string[], currentIndex: number) {
  if (currentIndex >= args.length - 1) {
    return false;
  }

  return !isOptionArg(args[currentIndex + 1]);
}

function buildConfigMaps(optionsConfig: OptionsConfig) {
  const configMap = new Map();
  const aliasMap = new Map();

  optionsConfig.forEach((entry) => {
    const { name, alias } = entry;
    configMap.set(name, entry);
    if (alias) {
      aliasMap.set(alias, name);
    } // alias points to verbose name config
  });

  return { configMap, aliasMap };
}

class OrdinaryArgParser {
  configMap: ConfigMap;
  aliasMap: AliasMap;
  result: ParseResult;

  constructor(configMap: ConfigMap, aliasMap: AliasMap) {
    this.configMap = configMap;
    this.aliasMap = aliasMap;
    this.result = { _: [] };
  }

  getAliasVerboseName(alias: string) {
    return this.aliasMap.get(alias);
  }

  getOptionConfig(option: string) {
    // is this an alias?
    const configKey = this.getAliasVerboseName(option) || option;
    return this.configMap.get(configKey);
  }

  storePositionalValues(...values: string[]) {
    this.result._.push(...values);
  }

  storeOptionValue(
    option: string,
    value: unknown,
    duplicateHandling: DuplicateHandling = "last-wins",
  ) {
    if (Object.hasOwn(this.result, option) && this.result[option] !== null) {
      const currentValue = this.result[option];

      if (duplicateHandling === "first-wins") {
        return;
      }

      if (duplicateHandling === "last-wins" && currentValue) {
        this.result[option] = value;
        return;
      }

      // Accumulate
      if (Array.isArray(currentValue)) {
        this.result[option] = [...currentValue, value];
        return;
      }

      this.result[option] = [currentValue, value];
    } else {
      this.result[option] = value;
    }
  }

  // Defaults are applied when an option was not present at all.
  applyDefaultValues() {
    for (const [name, cfg] of this.configMap.entries()) {
      if (cfg.default !== undefined && !Object.hasOwn(this.result, name)) {
        this.result[name] = cfg.default;
      }
    }
  }

  applyTransforms() {
    Object.entries(this.result).forEach(([key, value]) => {
      const transform = this.getOptionConfig(key)?.transform;

      if (transform) {
        this.result[key] = transform(value);
      }
    });
  }

  // Returns updated index (may consume the next argv element for required args).
  parseLongOption(content: string, args: string[], i: number): number {
    const { rawOption, inlineValue } = parseEqualsFormat(content);

    // Handle GNU-style "--no-foo" for boolean flags
    if (isNegativeOption(rawOption)) {
      const config = this.getOptionConfig(extractNegativeOption(rawOption));
      if (!config || config.kind !== "flag") {
        return i;
      }

      this.storeOptionValue(config.name, false, config.duplicateHandling);
      return i;
    }

    const config = this.getOptionConfig(rawOption);
    if (!config) {
      return i;
    }

    const { name, kind, duplicateHandling } = config;

    if (kind === "flag") {
      // Boolean flag
      // Works with common mistakes like --flag=[false | true]

      if (inlineValue === "false") {
        this.storeOptionValue(name, false, duplicateHandling);
      } else {
        this.storeOptionValue(name, true, duplicateHandling);
      }

      return i;
    }

    // Required argument
    if (inlineValue !== undefined) {
      this.storeOptionValue(name, inlineValue, duplicateHandling);
      return i;
    } else if (isNextArgValue(args, i)) {
      this.storeOptionValue(name, args[++i], duplicateHandling); // consume the value and advance iterator
    } else {
      this.storeOptionValue(name, null, duplicateHandling);
    }

    return i;
  }

  // Returns updated index (may consume the next argv element for required args).
  parseShortOption(content: string, args: string[], i: number): number {
    const { rawOption, inlineValue } = parseEqualsFormat(content);

    // Shortname options - could be single or grouped
    const optionsToProcess = expandShortCluster(rawOption);

    for (let j = 0; j < optionsToProcess.length; j++) {
      const arg = optionsToProcess[j];
      const config = this.getOptionConfig(arg);

      if (!config) {
        continue;
      }

      const { name, kind, duplicateHandling } = config;

      // Boolean flag
      if (kind === "flag") {
        if (inlineValue === "false") {
          this.storeOptionValue(name, false, duplicateHandling);
        } else {
          this.storeOptionValue(name, true, duplicateHandling);
        }

        continue;
      }

      // Required argument
      if (j === optionsToProcess.length - 1) {
        // Last option
        if (inlineValue !== undefined) {
          this.storeOptionValue(name, inlineValue, duplicateHandling);
        } else if (isNextArgValue(args, i)) {
          this.storeOptionValue(name, args[++i], duplicateHandling); // consume the value and advance iterator
        } else {
          this.storeOptionValue(name, null, duplicateHandling);
        }
      } else {
        // use eveything after the option as value
        // e.g. "-oattached.txt" becomes o: attached.txt
        this.storeOptionValue(
          name,
          optionsToProcess.slice(j + 1).join(""),
          duplicateHandling,
        );
        break;
      }
    }

    return i;
  }

  parse(args: string[] = []) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // "--" terminates option parsing
      if (arg === "--") {
        this.result._.push(...args.slice(i + 1));
        break;
      }

      if (isOptionArg(arg)) {
        const { hyphenCount, content } = stripHyphens(arg);

        if (hyphenCount === 2) {
          i = this.parseLongOption(content, args, i);

          continue;
        }

        if (hyphenCount === 1) {
          i = this.parseShortOption(content, args, i);
        }
      } else {
        // Positional argument
        this.storePositionalValues(arg);
      }
    }

    this.applyDefaultValues();
    this.applyTransforms();

    return this.result;
  }
}

export function ordinaryArgParser(
  args: string[] = [],
  optionsConfig: OptionsConfig = [],
) {
  const { configMap, aliasMap } = buildConfigMaps(optionsConfig);
  return new OrdinaryArgParser(configMap, aliasMap).parse(args);
}

export default ordinaryArgParser;
