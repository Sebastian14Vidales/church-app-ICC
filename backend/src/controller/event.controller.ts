import { Response } from "express";
import { Types } from "mongoose";
import * as xlsx from "xlsx";
import Event from "../models/event.model";
import UserProfile from "../models/user-profile.model";
import { emitRealtimeInvalidation } from "../realtime/socket";
import { AuthenticatedRequest } from "../types/auth";
import type { EventStatus } from "../types/event";

const EVENT_QUERY_KEYS = [["events"]];
const REGISTRABLE_ROLES = ["Asistente", "Miembro"];

interface PopulatedProfile {
  _id: Types.ObjectId | string;
  firstName: string;
  lastName: string;
  documentID: string;
  phoneNumber: string;
  neighborhood: string;
  role?: { _id: Types.ObjectId | string; name: string } | null;
  user?: unknown | null;
}

interface PopulatedRegistration {
  _id: Types.ObjectId | string;
  profile?: PopulatedProfile | null;
  status: "registered" | "cancelled";
  amountPaid: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PopulatedEvent {
  _id: Types.ObjectId | string;
  name: string;
  capacity: number;
  date: Date;
  time: string;
  place: string;
  price: number;
  description?: string;
  registrationDeadline?: Date | null;
  registrationClosed: boolean;
  registrations: PopulatedRegistration[];
  createdAt?: Date;
  updatedAt?: Date;
}

type PaymentStatus = "paid" | "partial" | "pending" | "cancelled";

interface FormattedRegistration {
  _id: string;
  status: "registered" | "cancelled";
  paymentStatus: PaymentStatus;
  amountPaid: number;
  balance: number;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
  profile: {
    _id: string;
    firstName: string;
    lastName: string;
    documentID: string;
    phoneNumber: string;
    neighborhood: string;
    role: { _id: string; name: string } | unknown;
    user: unknown | null;
  } | null;
}

interface FormattedEvent {
  _id: string;
  name: string;
  capacity: number;
  date: Date;
  time: string;
  place: string;
  price: number;
  description: string;
  registrationDeadline: Date | null;
  registrationClosed: boolean;
  registrationWindowClosed: boolean;
  daysUntilRegistrationDeadline: number | null;
  isPast: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  registrations: FormattedRegistration[];
  summary: {
    registeredCount: number;
    paidInFullCount: number;
    partialPaymentCount: number;
    debtCount: number;
    cancelledCount: number;
    paidTotal: number;
    pendingTotal: number;
    availableSpots: number;
    occupancyRate: number;
  };
}

const clampAmountPaid = (amountPaid: number, eventPrice: number) => {
  if (amountPaid < 0) {
    return { error: "El valor pagado no puede ser negativo" };
  }

  if (amountPaid > eventPrice) {
    return { error: "El valor pagado no puede superar el precio del evento" };
  }

  return { amountPaid };
};

const parseTime = (time: string): { hours: number; minutes: number; seconds: number } | null => {
  const match = String(time).trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return { hours, minutes, seconds };
};

const buildEventDateTime = (date: Date, time: string): Date | null => {
  const parsed = parseTime(time);

  if (!parsed) {
    return null;
  }

  const dateOnly = new Date(date);

  if (Number.isNaN(dateOnly.getTime())) {
    return null;
  }

  const datePart = dateOnly.toISOString().split("T")[0];
  const timePart = `${String(parsed.hours).padStart(2, "0")}:${String(parsed.minutes).padStart(2, "0")}:${String(parsed.seconds).padStart(2, "0")}`;
  const combined = new Date(`${datePart}T${timePart}`);

  if (Number.isNaN(combined.getTime())) {
    return null;
  }

  return combined;
};

const isPastEvent = (date: Date, time: string): boolean => {
  const eventDateTime = buildEventDateTime(date, time);

  if (!eventDateTime) {
    // Dato inconsistente: se devuelve false en lugar de fallar el listado.
    // `database-engineer` debe sanitizar formatos de `time` en producción.
    return false;
  }

  return eventDateTime.getTime() < Date.now();
};

const isRegistrationWindowClosed = (event: Pick<PopulatedEvent, "registrationClosed" | "registrationDeadline">) => {
  if (event.registrationClosed) {
    return true;
  }

  if (!event.registrationDeadline) {
    return false;
  }

  return new Date(event.registrationDeadline).getTime() < Date.now();
};

const getDaysUntilDeadline = (registrationDeadline?: Date | null) => {
  if (!registrationDeadline) {
    return null;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(registrationDeadline);
  deadline.setHours(0, 0, 0, 0);

  return Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
};

const resolvePaymentStatus = (amountPaid: number, price: number, isCancelled: boolean): PaymentStatus => {
  if (isCancelled) return "cancelled";
  if (price <= 0 || amountPaid >= price) return "paid";
  if (amountPaid > 0) return "partial";
  return "pending";
};

const formatEvent = (event: PopulatedEvent): FormattedEvent => {
  const registrations = (event.registrations ?? []).map((registration) => {
    const profile = registration.profile;
    const paid = Number(registration.amountPaid ?? 0);
    const price = Number(event.price ?? 0);
    const isCancelled = registration.status === "cancelled";
    const balance = isCancelled ? 0 : Math.max(price - paid, 0);

    return {
      _id: String(registration._id),
      status: registration.status,
      paymentStatus: resolvePaymentStatus(paid, price, isCancelled),
      amountPaid: paid,
      balance,
      notes: registration.notes ?? "",
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
      profile: profile
        ? {
            _id: String(profile._id),
            firstName: profile.firstName,
            lastName: profile.lastName,
            documentID: profile.documentID,
            phoneNumber: profile.phoneNumber,
            neighborhood: profile.neighborhood,
            role: profile.role ?? null,
            user: profile.user ?? null,
          }
        : null,
    };
  });

  const activeRegistrations = registrations.filter((registration) => registration.status !== "cancelled");
  const paidTotal = activeRegistrations.reduce(
    (total, registration) => total + Number(registration.amountPaid ?? 0),
    0,
  );
  const pendingTotal = activeRegistrations.reduce(
    (total, registration) => total + Number(registration.balance ?? 0),
    0,
  );
  const daysUntilDeadline = getDaysUntilDeadline(event.registrationDeadline);

  return {
    _id: String(event._id),
    name: event.name,
    capacity: event.capacity,
    date: event.date,
    time: event.time,
    place: event.place,
    price: event.price,
    description: event.description ?? "",
    registrationDeadline: event.registrationDeadline ?? null,
    registrationClosed: Boolean(event.registrationClosed),
    registrationWindowClosed: isRegistrationWindowClosed(event),
    daysUntilRegistrationDeadline: daysUntilDeadline,
    isPast: isPastEvent(event.date, event.time),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    registrations,
    summary: {
      registeredCount: activeRegistrations.length,
      paidInFullCount: activeRegistrations.filter((registration) => registration.paymentStatus === "paid").length,
      partialPaymentCount: activeRegistrations.filter((registration) => registration.paymentStatus === "partial").length,
      debtCount: activeRegistrations.filter((registration) =>
        ["pending", "partial"].includes(registration.paymentStatus),
      ).length,
      cancelledCount: registrations.filter((registration) => registration.status === "cancelled").length,
      paidTotal,
      pendingTotal,
      availableSpots: Math.max(event.capacity - activeRegistrations.length, 0),
      occupancyRate: event.capacity ? Math.round((activeRegistrations.length / event.capacity) * 100) : 0,
    },
  };
};

const sortEvents = (events: FormattedEvent[], direction: "asc" | "desc") => {
  const farFuture = new Date(8640000000000000);

  return events.slice().sort((a, b) => {
    const dateA = buildEventDateTime(new Date(a.date), a.time) ?? farFuture;
    const dateB = buildEventDateTime(new Date(b.date), b.time) ?? farFuture;
    const diff = dateA.getTime() - dateB.getTime();

    return direction === "asc" ? diff : -diff;
  });
};

const findEventById = async (eventId: string): Promise<PopulatedEvent | null> =>
  Event.findById(eventId)
    .populate({
      path: "registrations.profile",
      populate: [{ path: "role" }, { path: "user", populate: { path: "roles" } }],
    })
    .then((doc) => (doc ? (doc as unknown as PopulatedEvent) : null));

const validateRegistrableProfile = async (profileId: string) => {
  const profile = await UserProfile.findById(profileId).populate("role");

  if (!profile) {
    return { error: "El miembro o asistente no existe" };
  }

  const roleName =
    profile.role && typeof profile.role === "object" && "name" in profile.role
      ? String(profile.role.name)
      : "";

  if (!REGISTRABLE_ROLES.includes(roleName)) {
    return { error: "Solo puedes registrar asistentes o miembros" };
  }

  return { profile };
};

export class EventController {
  private static async listEvents(req: AuthenticatedRequest, res: Response, status?: EventStatus) {
    try {
      const events = await Event.find()
        .sort({ date: 1, time: 1 })
        .populate({
          path: "registrations.profile",
          populate: [{ path: "role" }, { path: "user", populate: { path: "roles" } }],
        });

      let formatted = events.map((event) => formatEvent(event as unknown as PopulatedEvent));

      if (status === "upcoming") {
        formatted = formatted.filter((event) => !event.isPast);
        formatted = sortEvents(formatted, "asc");
      } else if (status === "past") {
        formatted = formatted.filter((event) => event.isPast);
        formatted = sortEvents(formatted, "desc");
      } else {
        formatted = sortEvents(formatted, "asc");
      }

      return res.status(200).json(formatted);
    } catch {
      return res.status(500).json({ message: "Error al obtener eventos" });
    }
  }

  static findAll = async (req: AuthenticatedRequest, res: Response) => {
    const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;

    if (rawStatus && rawStatus !== "upcoming" && rawStatus !== "past") {
      return res.status(400).json({ message: "Parámetros de consulta inválidos" });
    }

    const status = rawStatus as EventStatus | undefined;
    return EventController.listEvents(req, res, status);
  };

  static findHistory = async (req: AuthenticatedRequest, res: Response) => {
    return EventController.listEvents(req, res, "past");
  };

  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        name,
        capacity,
        date,
        time,
        place,
        price,
        description,
        registrationDeadline,
        registrationClosed,
      } = req.body;

      const event = await Event.create({
        name,
        capacity,
        date,
        time,
        place,
        price,
        description,
        registrationDeadline: registrationDeadline || null,
        registrationClosed: Boolean(registrationClosed),
      });

      const createdEvent = await findEventById(String(event._id));
      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);

      return res.status(201).json({
        message: "Evento creado correctamente",
        event: createdEvent ? formatEvent(createdEvent) : null,
      });
    } catch {
      return res.status(500).json({ message: "Error al crear el evento" });
    }
  };

  static update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        capacity,
        date,
        time,
        place,
        price,
        description,
        registrationDeadline,
        registrationClosed,
      } = req.body;

      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const activeRegistrations = event.registrations.filter((registration) => registration.status !== "cancelled");
      if (Number(capacity) < activeRegistrations.length) {
        return res.status(400).json({
          message: "La capacidad no puede ser menor al número actual de inscritos activos",
        });
      }

      const hasPaymentAboveNewPrice = activeRegistrations.some(
        (registration) => Number(registration.amountPaid ?? 0) > Number(price),
      );

      if (hasPaymentAboveNewPrice) {
        return res.status(400).json({
          message: "No puedes bajar el precio del evento por debajo de un pago ya registrado",
        });
      }

      event.name = name;
      event.capacity = capacity;
      event.date = date;
      event.time = time;
      event.place = place;
      event.price = price;
      event.description = description;
      event.registrationDeadline = registrationDeadline || null;
      event.registrationClosed = Boolean(registrationClosed);

      await event.save();

      const updatedEvent = await findEventById(String(event._id));
      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);

      return res.status(200).json({
        message: "Evento actualizado correctamente",
        event: updatedEvent ? formatEvent(updatedEvent) : null,
      });
    } catch {
      return res.status(500).json({ message: "Error al actualizar el evento" });
    }
  };

  static remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const event = await Event.findByIdAndDelete(id);

      if (!event) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);
      return res.status(200).json({ message: "Evento eliminado correctamente" });
    } catch {
      return res.status(500).json({ message: "Error al eliminar el evento" });
    }
  };

  static exportRegistrations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const eventDoc = await Event.findById(id)
        .populate({
          path: "registrations.profile",
          populate: [{ path: "role" }, { path: "user", populate: { path: "roles" } }],
        })
        .then((doc) => (doc ? (doc as unknown as PopulatedEvent) : null));

      if (!eventDoc) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const event = formatEvent(eventDoc);

      const workbook = xlsx.utils.book_new();

      const registrationHeaders = [
        "Nombre completo",
        "Documento",
        "Teléfono",
        "Barrio",
        "Rol",
        "Estado de inscripción",
        "Estado de pago",
        "Valor pagado",
        "Saldo",
        "Observaciones",
        "Fecha de inscripción",
        "Última actualización",
      ];

      const registrationRows = event.registrations.map((registration) => {
        const profile = registration.profile;
        const paymentStatusLabel =
          registration.paymentStatus === "paid"
            ? "Pagado"
            : registration.paymentStatus === "partial"
              ? "Abono"
              : registration.paymentStatus === "pending"
                ? "Pendiente"
                : "Cancelado";

        return [
          profile ? `${profile.firstName} ${profile.lastName}` : "",
          profile?.documentID ?? "",
          profile?.phoneNumber ?? "",
          profile?.neighborhood ?? "",
          (profile?.role && typeof profile.role === "object" && "name" in profile.role
            ? String(profile.role.name)
            : ""),
          registration.status === "registered" ? "Registrado" : "Cancelado",
          paymentStatusLabel,
          registration.amountPaid,
          registration.balance,
          registration.notes ?? "",
          registration.createdAt ? new Date(registration.createdAt).toISOString() : "",
          registration.updatedAt ? new Date(registration.updatedAt).toISOString() : "",
        ];
      });

      const inscritosSheet = xlsx.utils.aoa_to_sheet([registrationHeaders, ...registrationRows]);
      xlsx.utils.book_append_sheet(workbook, inscritosSheet, "Inscritos");

      const summaryRows = [
        ["Nombre del evento", event.name],
        ["Fecha y hora", `${event.date.toISOString().split("T")[0]} ${event.time}`],
        ["Lugar", event.place],
        ["Capacidad", event.capacity],
        ["Inscritos activos", event.summary.registeredCount],
        ["Pagados", event.summary.paidInFullCount],
        ["Abonos", event.summary.partialPaymentCount],
        ["Pendientes", event.summary.debtCount],
        ["Cancelados", event.summary.cancelledCount],
        ["Total recaudado", event.summary.paidTotal],
        ["Total pendiente", event.summary.pendingTotal],
        ["Cupos disponibles", event.summary.availableSpots],
        ["% ocupación", event.summary.occupancyRate],
      ];

      const resumenSheet = xlsx.utils.aoa_to_sheet(summaryRows);
      xlsx.utils.book_append_sheet(workbook, resumenSheet, "Resumen");

      const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

      const eventDate = new Date(event.date);
      const dateSlug = !Number.isNaN(eventDate.getTime())
        ? eventDate.toISOString().split("T")[0].replace(/-/g, "")
        : new Date().toISOString().split("T")[0].replace(/-/g, "");

      const eventSlug =
        event.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .toLowerCase()
          .slice(0, 40) || "evento";

      const filename = `inscritos-${eventSlug}-${dateSlug}.xlsx`;

      return res
        .status(200)
        .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .set("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    } catch {
      return res.status(500).json({ message: "Error al generar el archivo de inscritos" });
    }
  };

  static upsertRegistration = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { profileId, status, amountPaid, notes } = req.body;
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const { error, profile } = await validateRegistrableProfile(profileId);
      if (error || !profile) {
        return res.status(400).json({ message: error });
      }

      const paymentValidation = clampAmountPaid(Number(amountPaid ?? 0), Number(event.price ?? 0));
      if ("error" in paymentValidation) {
        return res.status(400).json({ message: paymentValidation.error });
      }

      const duplicatedRegistration = event.registrations.find(
        (registration) => String(registration.profile) === profileId,
      );

      if (!duplicatedRegistration && isRegistrationWindowClosed(event) && status !== "cancelled") {
        return res.status(400).json({ message: "Las inscripciones de este evento ya están cerradas" });
      }

      if (!duplicatedRegistration) {
        const activeRegistrations = event.registrations.filter(
          (registration) => registration.status !== "cancelled",
        );

        if (status !== "cancelled" && activeRegistrations.length >= event.capacity) {
          return res.status(400).json({ message: "El evento ya alcanzó su capacidad máxima" });
        }

        event.registrations.push({
          profile: new Types.ObjectId(profileId),
          status,
          amountPaid: paymentValidation.amountPaid,
          notes,
        } as unknown as never);
      } else {
        if (duplicatedRegistration.status === "cancelled" && status !== "cancelled") {
          if (isRegistrationWindowClosed(event)) {
            return res.status(400).json({ message: "Las inscripciones de este evento ya están cerradas" });
          }

          const activeRegistrations = event.registrations.filter(
            (registration) => registration.status !== "cancelled",
          );

          if (activeRegistrations.length >= event.capacity) {
            return res.status(400).json({ message: "El evento ya alcanzó su capacidad máxima" });
          }
        }

        duplicatedRegistration.status = status;
        duplicatedRegistration.amountPaid = paymentValidation.amountPaid;
        duplicatedRegistration.notes = notes;
      }

      await event.save();

      const updatedEvent = await findEventById(id);
      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);

      return res.status(200).json({
        message: "Inscripción actualizada correctamente",
        event: updatedEvent ? formatEvent(updatedEvent) : null,
      });
    } catch {
      return res.status(500).json({ message: "Error al guardar la inscripción" });
    }
  };

  static updateRegistration = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, registrationId } = req.params;
      const { status, amountPaid, notes } = req.body;
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const registration = event.registrations.id(registrationId);

      if (!registration) {
        return res.status(404).json({ message: "Inscripción no encontrada" });
      }

      const paymentValidation = clampAmountPaid(
        Number(amountPaid ?? registration.amountPaid ?? 0),
        Number(event.price ?? 0),
      );
      if ("error" in paymentValidation) {
        return res.status(400).json({ message: paymentValidation.error });
      }

      if (registration.status === "cancelled" && status !== "cancelled") {
        if (isRegistrationWindowClosed(event)) {
          return res.status(400).json({ message: "Las inscripciones de este evento ya están cerradas" });
        }

        const activeRegistrations = event.registrations.filter((item) => item.status !== "cancelled");
        if (activeRegistrations.length >= event.capacity) {
          return res.status(400).json({ message: "El evento ya alcanzó su capacidad máxima" });
        }
      }

      registration.status = status;
      registration.amountPaid = paymentValidation.amountPaid;
      registration.notes = notes;

      await event.save();

      const updatedEvent = await findEventById(id);
      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);

      return res.status(200).json({
        message: "Detalle de inscripción actualizado",
        event: updatedEvent ? formatEvent(updatedEvent) : null,
      });
    } catch {
      return res.status(500).json({ message: "Error al actualizar la inscripción" });
    }
  };

  static removeRegistration = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, registrationId } = req.params;
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const registration = event.registrations.id(registrationId);

      if (!registration) {
        return res.status(404).json({ message: "Inscripción no encontrada" });
      }

      registration.deleteOne();
      await event.save();

      const updatedEvent = await findEventById(id);
      emitRealtimeInvalidation("events.changed", EVENT_QUERY_KEYS);

      return res.status(200).json({
        message: "Inscripción eliminada correctamente",
        event: updatedEvent ? formatEvent(updatedEvent) : null,
      });
    } catch {
      return res.status(500).json({ message: "Error al eliminar la inscripción" });
    }
  };
}
