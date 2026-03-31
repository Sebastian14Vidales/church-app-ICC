const NAME_SEGMENT_SEPARATOR = /([-'])/;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

const capitalizeSegment = (value: string) => {
    if (!value) return "";

    const normalizedValue = value.toLocaleLowerCase("es-CO");
    return normalizedValue.charAt(0).toLocaleUpperCase("es-CO") + normalizedValue.slice(1);
};

export const toDisplayName = (value: string) =>
    collapseWhitespace(value)
        .split(" ")
        .filter(Boolean)
        .map((word) =>
            word
                .split(NAME_SEGMENT_SEPARATOR)
                .map((segment) =>
                    NAME_SEGMENT_SEPARATOR.test(segment) ? segment : capitalizeSegment(segment),
                )
                .join(""),
        )
        .join(" ");

export const formatFullName = (firstName: string, lastName: string) =>
    [toDisplayName(firstName), toDisplayName(lastName)].filter(Boolean).join(" ");

export const normalizeSearchText = (value: string) =>
    collapseWhitespace(value)
        .normalize("NFD")
        .replace(DIACRITICS_REGEX, "")
        .toLocaleLowerCase("es-CO");
