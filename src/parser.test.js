import { describe, expect, test } from 'vitest'
import {ordinaryArgParser} from './parser';

describe('Ordinary Arg Parser', () => {
  const baseArgs = ['file.txt', '--foo', '--bar=baz', '-mtv', '--', 'hello', 'world']

  test("Parses only positional args without a schema", () => {
    const result = ordinaryArgParser(baseArgs)

    const expectedResult = {
    '_': ['file.txt'],
    '--': ['hello', 'world'],
    }

    expect(result).toEqual(expectedResult)
  })

  test("Skips options absent in schema", () => {
    const schema = [
      {name: 'foo'},
    ]

    const expectedResult = {
      '_': ['file.txt'],
      '--': ['hello', 'world'],
      foo: null
    }

    const result = ordinaryArgParser(baseArgs, schema)

    expect(result).toEqual(expectedResult)
  })

  test("Applies default values from schema for options without a value", () => {
    const schema = [
      {name: 'foo', default: 'defaultFoo'},
    ]

    const expectedResult = {
      '_': ['file.txt'],
      '--': ['hello', 'world'],
      foo: 'defaultFoo'
    }

    const result = ordinaryArgParser(baseArgs, schema)

    expect(result).toEqual(expectedResult)
  })

  // Alias - only alias and verbose + alias
  test("Parses short names", () => {
    const args = ['-f=fooValue', '-b', 'baz', '--file', 'data.csv']
    const schema = [
      {name: 'foo', alias: 'f'},
      {name: 'bar', alias: 'b'},
      {name: 'file'},
    ]

    const expectedResult = {
      _: [],
      foo: 'fooValue',
      bar: 'baz',
      file: 'data.csv'
    }

    const result = ordinaryArgParser(args, schema)

    expect(result).toEqual(expectedResult)
  })

  test("Applies tranforms on result", () => {
    const args = ['show', '--file', 'data.csv', '--count=5']
    const schema = [
      {name: 'file'},
      {name: 'count', transform: (value) => Number.parseInt(value)}
    ]

    const expectedResult = {
      _: ['show'],
      file: 'data.csv',
      count: 5
    }

    const result = ordinaryArgParser(args, schema)

    expect(result).toEqual(expectedResult)
  })
})
