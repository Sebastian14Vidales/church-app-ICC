import api from "@/lib/axios";
import { extractDateOnly } from "@/utils/date";
import { z } from "zod";

const eventRegistrationProfileSchema = z.object({
  _id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  documentID: z.string(),
  phoneNumber: z.string(),
  neighborhood: z.string(),
  role: z.object({
    _id: z.string(),
    name: z.string(),
  }),
  user: z
    .object({
      _id: z.string(),
      email: z.string().email(),
      name: z.string(),
    })
    .nullable()
    .default(null),
});

export const eventRegistrationSchema = z.object({
  _id: z.string(),
  status: z.enum(["registered", "cancelled"]),
  paymentStatus: z.enum(["paid", "partial", "pending", "cancelled"]),
  amountPaid: z.number(),
  balance: z.number(),
  notes: z.string().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  profile: eventRegistrationProfileSchema.nullable(),
});

export const eventSchema = z.object({
  _id: z.string(),
  name: z.string(),
  capacity: z.number(),
  date: z.string(),
  time: z.string(),
  place: z.string(),
  price: z.number(),
  description: z.string().default(""),
  registrationDeadline: z.string().nullable().default(null),
  registrationClosed: z.boolean().default(false),
  registrationWindowClosed: z.boolean().default(false),
  daysUntilRegistrationDeadline: z.number().nullable().default(null),
  isPast: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  registrations: z.array(eventRegistrationSchema).default([]),
  summary: z.object({
    registeredCount: z.number(),
    paidInFullCount: z.number(),
    partialPaymentCount: z.number(),
    debtCount: z.number(),
    cancelledCount: z.number(),
    paidTotal: z.number(),
    pendingTotal: z.number(),
    availableSpots: z.number(),
    occupancyRate: z.number(),
  }),
});

export const eventStatusSchema = z.enum(["upcoming", "past"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventListQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type EventListQuery = z.infer<typeof eventListQuerySchema>;

const eventsSchema = z.array(eventSchema);
const eventResponseSchema = z.object({
  event: eventSchema.nullable(),
  message: z.string(),
});
const messageResponseSchema = z.object({
  message: z.string(),
});

export type Event = z.infer<typeof eventSchema>;
export type EventRegistration = z.infer<typeof eventRegistrationSchema>;
export type EventFormData = {
  name: string;
  capacity: number;
  date: string;
  time: string;
  place: string;
  price: number;
  description?: string;
  registrationDeadline?: string;
  registrationClosed: boolean;
};

export type EventRegistrationFormData = {
  profileId: string;
  status: "registered" | "cancelled";
  amountPaid: number;
  notes?: string;
};

export type EventRegistrationsExport = Blob;

const normalizeEvent = (event: Event): Event => ({
  ...event,
  date: extractDateOnly(event.date),
  registrationDeadline: event.registrationDeadline ? extractDateOnly(event.registrationDeadline) : null,
});

const parseEventFromResponse = (data: unknown) => {
  const parsed = eventResponseSchema.parse(data).event;

  if (!parsed) {
    throw new Error("La respuesta del evento llego vacia");
  }

  return normalizeEvent(parsed);
};

export const getAllEvents = async (): Promise<Event[]> => {
  const { data } = await api.get("/events");
  return eventsSchema.parse(data).map(normalizeEvent);
};

export const createEvent = async (payload: EventFormData): Promise<Event> => {
  const { data } = await api.post("/events", payload);
  return parseEventFromResponse(data);
};

export const updateEvent = async (id: string, payload: EventFormData): Promise<Event> => {
  const { data } = await api.put(`/events/${id}`, payload);
  return parseEventFromResponse(data);
};

export const deleteEvent = async (id: string): Promise<string> => {
  const { data } = await api.delete(`/events/${id}`);
  return messageResponseSchema.parse(data).message;
};

export const upsertEventRegistration = async (
  eventId: string,
  payload: EventRegistrationFormData,
): Promise<Event> => {
  const { data } = await api.post(`/events/${eventId}/registrations`, payload);
  return parseEventFromResponse(data);
};

export const updateEventRegistration = async (
  eventId: string,
  registrationId: string,
  payload: Omit<EventRegistrationFormData, "profileId">,
): Promise<Event> => {
  const { data } = await api.put(`/events/${eventId}/registrations/${registrationId}`, payload);
  return parseEventFromResponse(data);
};

export const deleteEventRegistration = async (
  eventId: string,
  registrationId: string,
): Promise<Event> => {
  const { data } = await api.delete(`/events/${eventId}/registrations/${registrationId}`);
  return parseEventFromResponse(data);
};

export const getEventsByStatus = async (status: EventStatus): Promise<Event[]> => {
  const { data } = await api.get("/events", { params: { status } });
  return eventsSchema.parse(data).map(normalizeEvent);
};

export const getEventHistory = async (): Promise<Event[]> => {
  const { data } = await api.get("/events/history");
  return eventsSchema.parse(data).map(normalizeEvent);
};

export const exportEventRegistrations = async (eventId: string): Promise<Blob> => {
  const response = await api.get<Blob>(`/events/${eventId}/export/registrations`, {
    responseType: "blob",
  });
  return response.data;
};
