export const LOCATIONS = [
  { id: "1", name: "Salon Principal" },
  { id: "2", name: "Salon de Jovenes" },
  { id: "3", name: "Salon de Ninos" },
  { id: "4", name: "Aula 1" },
  { id: "5", name: "Aula 2" },
] as const;

export const getLocationNameById = (locationId: string) =>
  LOCATIONS.find((location) => location.id === locationId)?.name ?? locationId;