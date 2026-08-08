const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export const extractDateOnly = (value: string) => {
  const match = value.match(DATE_ONLY_PATTERN);
  return match ? match[0] : value;
};

export const parseStoredDate = (value: string) => {
  const normalizedValue = extractDateOnly(value);

  if (DATE_ONLY_PATTERN.test(normalizedValue)) {
    const [year, month, day] = normalizedValue.split("-").map(Number);

    // Use local noon to avoid timezone and DST shifts when formatting date-only values.
    return new Date(year, month - 1, day, 12);
  }

  return new Date(normalizedValue);
};

export const getStoredDateYear = (value: string) => parseStoredDate(value).getFullYear();

/**
 * Opciones de hora de inicio en horas enteras (formato 24h "HH:00").
 * Solo se ofrecen horas en punto (1, 2, 3...) para simplificar la captura.
 */
export const START_TIME_OPTIONS: Array<{ value: string; label: string }> = Array.from(
  { length: 24 },
  (_, hour) => {
    const value = `${`${hour}`.padStart(2, "0")}:00`;
    return { value, label: value };
  },
);
