const toFixed = (value: number): string => {
  // return value to fixed with decimal places, only if the value is not an integer
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2);
};

const humanizeNumber = (value: number): string => {
  // humanize big values, such as 1000 into 1k, 1000000 into 1M, etc.
  if (value >= 1e12) {
    return `${toFixed(value / 1e12)}T`;
  }
  if (value >= 1e9) {
    return `${toFixed(value / 1e9)}B`;
  }
  if (value >= 1e6) {
    return `${toFixed(value / 1e6)}M`;
  }
  if (value >= 1e3) {
    return `${toFixed(value / 1e3)}K`;
  }

  return value.toString();
};

export const formatValue = (value: string | number): string => {
  if (typeof value === 'number') {
    return humanizeNumber(value);
  } else if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return humanizeNumber(num);
    }
  }

  return value;
};
