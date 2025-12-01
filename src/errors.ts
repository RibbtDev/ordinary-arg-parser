class ArgParseError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);

    this.name = "ArgParseError";
    this.code = code;
  }

  getErrorData() {
    // Subclasses ovveride to include specific properties
    return {};
  }

  // Get data for logging/telemetry
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...this.getErrorData(),
    };
  }
}

export class UnknownArgumentError extends ArgParseError {
  readonly argument: string;
  readonly rawArgs: string[];

  constructor(argument: string, rawArgs: string[]) {
    super(`Unknown argument '${argument}'.`, "UNKNOWN_ARGUMENT");

    this.argument = argument;
    this.rawArgs = rawArgs;
  }

  getErrorData() {
    return {
      argument: this.argument,
      rawArgs: this.rawArgs,
    };
  }
}

export class MissingValueError extends ArgParseError {
  readonly argument: string;
  readonly rawArgs: string[];

  constructor(argument: string, rawArgs: string[]) {
    super(`Argument '${argument}' requires a value.`, "MISSING_VALUE");

    this.argument = argument;
    this.rawArgs = rawArgs;
  }

  getErrorData() {
    return {
      argument: this.argument,
      rawArgs: this.rawArgs,
    };
  }
}
