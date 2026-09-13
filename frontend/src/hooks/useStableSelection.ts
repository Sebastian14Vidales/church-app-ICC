import { useMemo } from "react";

/**
 * Normaliza un valor de selección (simple o múltiple) en un `Set<string>`
 * estable para usar como `selectedKeys` de HeroUI Select.
 *
 * La referencia del Set solo cambia cuando cambia el valor subyacente, no
 * en cada render. Esto evita que React Aria resetee su estado interno y
 * provoque el parpadeo (flash) del trigger cuando el padre re-renderiza.
 */
export function useStableSelection(
  value: string | string[] | undefined | null,
): Set<string> {
  return useMemo(() => {
    if (Array.isArray(value)) {
      return new Set(value);
    }

    if (value) {
      return new Set([value]);
    }

    return new Set<string>();
  }, [value]);
}
