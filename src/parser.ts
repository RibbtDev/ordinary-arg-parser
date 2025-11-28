
export type OptionValue = string | boolean | null

export interface ParseResult {
  _: string[],
  [k: string]: OptionValue | OptionValue[]
}

export interface ParserSchemaEntry {
  name: string,
  alias?: string, // short name
  required?: boolean,
  defaultValue?: OptionValue
}

function isTerminalArg(arg: string) {
  return arg === '--'
}

function isOptionArg(arg: string) {
  return arg.startsWith('-')
}

function parseOption(arg: string) {
  const hyphenCount = [...arg].findIndex((a) => a !== '-')
  const option = arg.slice(hyphenCount)

  return {hyphenCount, option}
}

function parseEqualsFormat(arg: string) {
  const [option, value] = arg.split('=')

  return {option, value}
}

function expandGroupedOptions(option: string) {
  if (option.length > 1) {
    return option.split('')
  }

  return [option]
}

function isNegativeOption(option: string) {
  return option.startsWith('no')
}

function extractNegativeOption(option:string) {
  return option.slice(3) // 'no-' is three characters long
}

function isNextArgValue(args: string[], currentIndex: number) {
  if (currentIndex >= args.length - 1) {
    return false
  }

  return !isOptionArg(args[currentIndex + 1])
}

function buildConfigFromSchema(schema: ParserSchemaEntry[]) {
  const schemaMap = new Map()
  const aliasMap = new Map()

  schema.forEach((entry) => {
    const {name, alias} = entry
    schemaMap.set(name, entry)
    if (alias) { aliasMap.set(alias, name) } // alias points to verbose name config
  })

  return {schemaMap, aliasMap}
}


class OrdinaryArgParser {
  schemaMap: Map<string, ParserSchemaEntry>
  aliasMap: Map<string, string>
  result: ParseResult

  constructor(schema: ParserSchemaEntry[] = []) {
    const {schemaMap, aliasMap} = buildConfigFromSchema(schema)

    this.schemaMap = schemaMap
    this.aliasMap = aliasMap
    this.result = {_: []}
  }

  getAliasVerboseName(alias: string) {
    return this.aliasMap.get(alias)
  }

  getOptionConfig(option: string) {
    // is this an alias?
    const schemaKey = this.getAliasVerboseName(option) || option
    return this.schemaMap.get(schemaKey)
  }

  storePositionalValues(...values: string[]) {
    this.result['_'].push(...values)
  }

  isKnownOption(option: string) {
    return Boolean(this.getOptionConfig(option)?.name)
  }

  storeOptionValue(option: string, value: OptionValue) {
    // A value is already present
    if (Object.hasOwn(this.result, option)) {
      const currentValue = this.result[option]

      if (Array.isArray(currentValue)) {
        this.result[option] = [...currentValue, value]
        return
      }

      this.result[option] = [currentValue, value]
    } else {
      this.result[option] = value
    }
  }

  applyDefaultValues() {
    Object.entries(this.result).forEach(([key, value]) => {
      const defaultValue = this.getOptionConfig(key)?.defaultValue

      if (value === null && defaultValue) {
        this.result[key] = defaultValue
      }
    })
  }

  parse(args: string[] = []) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      if (isTerminalArg(arg)) {
        this.result['--'] = args.slice(i+1)
        break
      }

      if (isOptionArg(arg)) {
        const {hyphenCount, option} = parseOption(arg)

        if (isNegativeOption(option)) {
          const optionName = extractNegativeOption(option)
          if (this.isKnownOption(optionName)) { this.storeOptionValue(optionName, false) }

          continue
        }

        if (hyphenCount === 2) {
          // Verbose option
          const {option: optionName, value: inlineValue} = parseEqualsFormat(option)

          if (this.isKnownOption(optionName)) { 
            if (inlineValue) {
              this.storeOptionValue(optionName, inlineValue)
            } else if (isNextArgValue(args, i)) {
              this.storeOptionValue(optionName, args[++i]) // consume the value and advance iterator
            } else {
              this.storeOptionValue(optionName, null)
            }
          }

          continue
        }

        // Shortname options - could be single or grouped
        const {option: optionName, value: inlineValue} = parseEqualsFormat(option)
        const optionsToProcess = expandGroupedOptions(optionName)

        for (let j = 0; j < optionsToProcess.length; j++) {
          const arg = optionsToProcess[j]
          const name = this.getAliasVerboseName(arg)

          if (!name) {
            continue
          }

          if (j === optionsToProcess.length - 1) {
            // Last option
            if (inlineValue) {
              this.storeOptionValue(name, inlineValue)
            } else if (isNextArgValue(args, i)) {
              this.storeOptionValue(name, args[++i]) // consume the value and advance iterator
            } else {
              this.storeOptionValue(name, true)
            }
          } else {
            this.storeOptionValue(name, true)
          }
          
        }

      } else {
        // Positional argument
        this.storePositionalValues(arg)
      }
    }

    this.applyDefaultValues()

    return this.result
  }

}

export function ordinaryArgParser(args: string[] = [], schema: ParserSchemaEntry[] = []){
  return new OrdinaryArgParser(schema).parse(args)
}

export default ordinaryArgParser
