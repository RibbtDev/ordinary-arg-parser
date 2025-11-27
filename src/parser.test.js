import { describe, expect, test } from 'vitest'
import {OrdinaryArgParser} from './parser';

describe('Ordinary Arg Parser', () => {
  const baseArgs = ['file.txt', '--foo', '--bar=baz', '-mtv', '--', 'hello', 'world']

  test("Parses only positional args without a schema", () => {
    const parser = new OrdinaryArgParser()
    const result = parser.parse(baseArgs)

    const expectedResult = {
      _: ['file.txt', 'hello', 'world'],
    }

    expect(result).toEqual(expectedResult)
  })

  test("Skips options absent in schema", () => {
    const schema = [
      {name: 'foo'},
    ]

    const parser = new OrdinaryArgParser(schema)
    const result = parser.parse(baseArgs)

    const expectedResult = {
      _: ['file.txt', 'hello', 'world'],
      foo: null
    }

    expect(result).toEqual(expectedResult)
  })

  test("Applies default values from schema for options without a value", () => {
    const schema = [
      {name: 'foo', defaultValue: 'defaultFoo'},
    ]

    const parser = new OrdinaryArgParser(schema)
    const result = parser.parse(baseArgs)

    const expectedResult = {
      _: ['file.txt', 'hello', 'world'],
      foo: 'defaultFoo'
    }

    expect(result).toEqual(expectedResult)
  })

  // Alias - only alias and verbose + alias
  test("Parses short names", () => {
    const args = ['-f=fooValue', '-b=baz']
    const schema = [
      {name: 'foo', alias: 'f'},
      {name: 'bar', alias: 'b'},
    ]

    const parser = new OrdinaryArgParser(schema)
    const result = parser.parse(args)

    const expectedResult = {
      _: [],
      foo: 'fooValue',
      bar: 'baz'
    }

    expect(result).toEqual(expectedResult)
  })
})

