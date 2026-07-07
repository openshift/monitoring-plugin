import * as _ from 'lodash-es';

const TYPES = {
  numeric: {
    units: ['', 'k', 'm', 'b'],
    space: false,
    divisor: 1000,
  },
  binaryBytes: {
    units: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'],
    space: true,
    divisor: 1024,
  },
  decimalBytes: {
    units: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'],
    space: true,
    divisor: 1000,
  },
  SI: {
    units: ['', 'k', 'M', 'G', 'T', 'P', 'E'],
    space: false,
    divisor: 1000,
  },
  decimalBytesPerSec: {
    units: ['Bps', 'KBps', 'MBps', 'GBps', 'TBps', 'PBps', 'EBps'],
    space: true,
    divisor: 1000,
  },
  binaryBytesPerSec: {
    units: ['Bps', 'KiBps', 'MiBps', 'GiBps', 'TiBps', 'PiBps', 'EiBps'],
    space: true,
    divisor: 1024,
  },
  packetsPerSec: {
    units: ['pps', 'kpps'],
    space: true,
    divisor: 1000,
  },
  seconds: {
    units: ['ns', 'μs', 'ms', 's'],
    space: true,
    divisor: 1000,
  },
};

const getType = (name: string) => {
  const type = TYPES[name];
  if (!_.isPlainObject(type)) {
    return {
      units: [],
      space: false,
      divisor: 1000,
    };
  }
  return type;
};

const convertBaseValueToUnits = (
  value: number,
  unitArray: Array<string>,
  divisor: number,
  initialUnit: string,
  preferredUnit: string,
) => {
  const sliceIndex = initialUnit ? unitArray.indexOf(initialUnit) : 0;
  const units_ = unitArray.slice(sliceIndex);

  if (preferredUnit || preferredUnit === '') {
    const unitIndex = units_.indexOf(preferredUnit);
    if (unitIndex !== -1) {
      return {
        value: value / divisor ** unitIndex,
        unit: preferredUnit,
      };
    }
  }

  let unit = units_.shift();
  while (value >= divisor && units_.length > 0) {
    value = value / divisor;
    unit = units_.shift();
  }
  return { value, unit };
};

const getDefaultFractionDigits = (value: number) => {
  if (value < 1) {
    return 3;
  }
  if (value < 100) {
    return 2;
  }
  return 1;
};

const formatValue = (value: number) => {
  const fractionDigits = getDefaultFractionDigits(value);

  // 2nd check converts -0 to 0.
  if (!isFinite(value) || value === 0) {
    value = 0;
  }
  return Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

const round = (value: number, fractionDigits?: number) => {
  if (!isFinite(value)) {
    return 0;
  }
  const multiplier = Math.pow(10, fractionDigits || getDefaultFractionDigits(value));
  return Math.round(value * multiplier) / multiplier;
};

const humanize = (
  value: number,
  typeName: string,
  useRound = false,
  initialUnit: string,
  preferredUnit: string,
) => {
  const type = getType(typeName);

  if (!isFinite(value)) {
    value = 0;
  }

  let converted = convertBaseValueToUnits(
    value,
    type.units,
    type.divisor,
    initialUnit,
    preferredUnit,
  );

  if (useRound) {
    converted.value = round(converted.value);
    converted = convertBaseValueToUnits(
      converted.value,
      type.units,
      type.divisor,
      converted.unit,
      preferredUnit,
    );
  }

  const formattedValue = formatValue(converted.value);

  return {
    string: type.space ? `${formattedValue} ${converted.unit}` : formattedValue + converted.unit,
    unit: converted.unit,
    value: converted.value,
  };
};

export const humanizeBinaryBytes = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'binaryBytes', true, initialUnit, preferredUnit);
export const humanizeDecimalBytes = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'decimalBytes', true, initialUnit, preferredUnit);
export const humanizeBinaryBytesPerSec = (
  v: number,
  initialUnit?: string,
  preferredUnit?: string,
) => humanize(v, 'binaryBytesPerSec', true, initialUnit, preferredUnit);
export const humanizeDecimalBytesPerSec = (
  v: number,
  initialUnit?: string,
  preferredUnit?: string,
) => humanize(v, 'decimalBytesPerSec', true, initialUnit, preferredUnit);
export const humanizePacketsPerSec = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'packetsPerSec', true, initialUnit, preferredUnit);
export const humanizeNumber = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'numeric', true, initialUnit, preferredUnit);
export const humanizeNumberSI = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'SI', true, initialUnit, preferredUnit);
export const humanizeSeconds = (v: number, initialUnit?: string, preferredUnit?: string) =>
  humanize(v, 'seconds', true, initialUnit, preferredUnit);
