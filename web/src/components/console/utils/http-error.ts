import { CustomError } from './custom-error';

export class TimeoutError extends CustomError {
  public constructor(public url: string, public ms: number) {
    super(`Call to ${url} timed out after ${ms}ms.`);
  }
}

export class IncompleteDataError extends CustomError {
  public constructor(public labels: string[]) {
    super(`Could not fetch all data. This data are missing: ${labels.join(', ')}.`);
  }
}
