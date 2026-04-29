import api from "@/lib/axios";
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

const eventRegistrationSchema = z.object({
  _id: z.string(),
  status: z.enum(["registered", "cancelled"]),
  paymentStatus: z.enum(["pending", "partial", "paid", "cancelled"]),
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

const eventsSchema = z.array(eventSchema);
const eventResponseSchema = z.object({
  event: eventSchema,
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
export type EventRegistrationUpdateData = Omit<EventRegistrationFormData, "profileId">;

export const getAllEvents = async (): Promise<Event[]> => {
  const { data } = await api.get("/events");
  return eventsSchema.parse(data);
};

export const createEvent = async (payload: EventFormData): Promise<Event> => {
  const { data } = await api.post("/events", payload);
  return eventResponseSchema.parse(data).event;
};

export const updateEvent = async (id: string, payload: EventFormData): Promise<Event> => {
  const { data } = await api.put(`/events/${id}`, payload);
  return eventResponseSchema.parse(data).event;
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
  return eventResponseSchema.parse(data).event;
};

export const updateEventRegistration = async (
  eventId: string,
  registrationId: string,
  payload: EventRegistrationUpdateData,
): Promise<Event> => {
  const { data } = await api.patch(`/events/${eventId}/registrations/${registrationId}`, payload);
  return eventResponseSchema.parse(data).event;
};

export const deleteEventRegistration = async (
  eventId: string,
  registrationId: string,
): Promise<string> => {
  const { data } = await api.delete(`/events/${eventId}/registrations/${registrationId}`);
  return messageResponseSchema.parse(data).message;
};
