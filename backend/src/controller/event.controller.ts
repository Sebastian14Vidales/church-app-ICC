import { Response } from "express";
import { Types } from "mongoose";
import Event from "../models/event.model";
import UserProfile from "../models/user-profile.model";
import { emitRealtimeInvalidation } from "../realtime/socket";
import { AuthenticatedRequest } from "../types/auth";

const EVENT_QUERY_KEYS = [["events"]];
const REGISTRABLE_ROLES = ["Asistente", "Miembro"];

const clampAmountPaid = (amountPaid: number, eventPrice: number) => {
  if (amountPaid < 0) {
    return { error: "El valor pagado no puede ser negativo" };
  }

  if (amountPaid > eventPrice) {
    return { error: "El valor pagado no puede superar el precio del evento" };
  }

  return { amountPaid };
};

const isRegistrationWindowClosed = (event: any) => {
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

const resolvePaymentStatus = (amountPaid: number, price: number, isCancelled: boolean) => {
  if (isCancelled) return "cancelled";
  if (price <= 0 || amountPaid >= price) return "paid";
  if (amountPaid > 0) return "partial";
  return "pending";
};

const formatEvent = (event: any) => {
  const registrations = (event.registrations ?? []).map((registration: any) => {
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
            role: profile.role,
            user: profile.user ?? null,
          }
        : null,
    };
  });

  const activeRegistrations = registrations.filter(
    (registration: any) => registration.status !== "cancelled",
  );
  const paidTotal = activeRegistrations.reduce(
    (total: number, registration: any) => total + Number(registration.amountPaid ?? 0),
    0,
  );
  const pendingTotal = activeRegistrations.reduce(
    (total: number, registration: any) => total + Number(registration.balance ?? 0),
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
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    registrations,
    summary: {
      registeredCount: activeRegistrations.length,
      paidInFullCount: activeRegistrations.filter((registration: any) => registration.paymentStatus === "paid").length,
      partialPaymentCount: activeRegistrations.filter((registration: any) => registration.paymentStatus === "partial").length,
      debtCount: activeRegistrations.filter((registration: any) =>
        ["pending", "partial"].includes(registration.paymentStatus),
      ).length,
      cancelledCount: registrations.filter((registration: any) => registration.status === "cancelled").length,
      paidTotal,
      pendingTotal,
      availableSpots: Math.max(event.capacity - activeRegistrations.length, 0),
      occupancyRate: event.capacity ? Math.round((activeRegistrations.length / event.capacity) * 100) : 0,
    },
  };
};

const findEventById = async (eventId: string) =>
  Event.findById(eventId).populate({
    path: "registrations.profile",
    populate: [{ path: "role" }, { path: "user", populate: { path: "roles" } }],
  });

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
  static findAll = async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const events = await Event.find()
        .sort({ date: 1, time: 1 })
        .populate({
          path: "registrations.profile",
          populate: [{ path: "role" }, { path: "user", populate: { path: "roles" } }],
        });

      return res.status(200).json(events.map(formatEvent));
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener eventos", error });
    }
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
    } catch (error) {
      return res.status(500).json({ message: "Error al crear el evento", error });
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
    } catch (error) {
      return res.status(500).json({ message: "Error al actualizar el evento", error });
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
    } catch (error) {
      return res.status(500).json({ message: "Error al eliminar el evento", error });
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
        } as any);
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
    } catch (error) {
      return res.status(500).json({ message: "Error al guardar la inscripción", error });
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
    } catch (error) {
      return res.status(500).json({ message: "Error al actualizar la inscripción", error });
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
    } catch (error) {
      return res.status(500).json({ message: "Error al eliminar la inscripción", error });
    }
  };
}
