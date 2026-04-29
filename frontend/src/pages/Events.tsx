import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Lock,
  MapPin,
  Plus,
  Receipt,
  Trash2,
  Unlock,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { toast } from "react-toastify";
import {
  createEvent,
  deleteEvent,
  deleteEventRegistration,
  getAllEvents,
  type Event,
  type EventFormData,
  type EventRegistration,
  type EventRegistrationFormData,
  updateEvent,
  updateEventRegistration,
  upsertEventRegistration,
} from "@/api/EventAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { formatFullName } from "@/utils/text";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const PAYMENT_STATUS_LABELS = {
  pending: "Debe completo",
  partial: "Abonó, aún debe",
  paid: "Pago completo",
  cancelled: "Cancelado",
} as const;

const PAYMENT_STATUS_STYLES = {
  pending: "bg-rose-100 text-rose-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
} as const;

const REGISTRATION_STATUS_LABELS = {
  registered: "Activo",
  cancelled: "Cancelado",
} as const;

type RegistrationFormValues = EventRegistrationFormData;

const escapeCsv = (value: string | number | null | undefined) => {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
};

export default function Events() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<EventRegistration | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: getAllEvents,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const registrableMembers = useMemo(
    () => members.filter((member) => ["Asistente", "Miembro"].includes(member.role.name)),
    [members],
  );

  const eventForm = useForm<EventFormData>({
    defaultValues: {
      name: "",
      capacity: 50,
      date: "",
      time: "",
      place: "",
      price: 0,
      description: "",
      registrationDeadline: "",
      registrationClosed: false,
    },
  });

  const registrationForm = useForm<RegistrationFormValues>({
    defaultValues: {
      profileId: "",
      status: "registered",
      amountPaid: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!selectedEventId && events[0]?._id) {
      setSelectedEventId(events[0]._id);
    }

    if (selectedEventId && !events.some((event) => event._id === selectedEventId)) {
      setSelectedEventId(events[0]?._id ?? null);
    }
  }, [events, selectedEventId]);

  const selectedEvent = events.find((event) => event._id === selectedEventId) ?? null;
  const watchedAmountPaid = registrationForm.watch("amountPaid");
  const watchedStatus = registrationForm.watch("status");
  const remainingBalance = Math.max((selectedEvent?.price ?? 0) - Number(watchedAmountPaid || 0), 0);

  const selectedEventStats = selectedEvent
    ? {
        debtors: selectedEvent.summary.debtCount,
        collected: selectedEvent.summary.paidTotal,
        pending: selectedEvent.summary.pendingTotal,
        deadlineMessage: selectedEvent.registrationWindowClosed
          ? "Inscripciones cerradas"
          : selectedEvent.daysUntilRegistrationDeadline == null
            ? "Sin fecha límite de inscripción"
            : selectedEvent.daysUntilRegistrationDeadline > 0
              ? `Faltan ${selectedEvent.daysUntilRegistrationDeadline} días para las inscripciones`
              : selectedEvent.daysUntilRegistrationDeadline === 0
                ? "Las inscripciones cierran hoy"
                : "Inscripciones vencidas",
      }
    : {
        debtors: 0,
        collected: 0,
        pending: 0,
        deadlineMessage: "Selecciona un evento para ver el detalle",
      };

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (event) => {
      toast.success("Evento creado correctamente");
      setSelectedEventId(event._id);
      setIsEventModalOpen(false);
      setEditingEvent(null);
      eventForm.reset();
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo crear el evento"),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EventFormData }) => updateEvent(id, payload),
    onSuccess: (event) => {
      toast.success("Evento actualizado correctamente");
      setSelectedEventId(event._id);
      setIsEventModalOpen(false);
      setEditingEvent(null);
      eventForm.reset();
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo actualizar el evento"),
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: (message) => {
      toast.success(message);
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo eliminar el evento"),
  });

  const saveRegistrationMutation = useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: RegistrationFormValues;
    }) => upsertEventRegistration(eventId, payload),
    onSuccess: (event) => {
      toast.success("Inscripción guardada correctamente");
      setSelectedEventId(event._id);
      setIsRegistrationModalOpen(false);
      setEditingRegistration(null);
      registrationForm.reset({
        profileId: "",
        status: "registered",
        amountPaid: 0,
        notes: "",
      });
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo guardar la inscripción"),
  });

  const updateRegistrationMutation = useMutation({
    mutationFn: ({
      eventId,
      registrationId,
      payload,
    }: {
      eventId: string;
      registrationId: string;
      payload: Omit<RegistrationFormValues, "profileId">;
    }) => updateEventRegistration(eventId, registrationId, payload),
    onSuccess: (event) => {
      toast.success("Inscripción actualizada correctamente");
      setSelectedEventId(event._id);
      setIsRegistrationModalOpen(false);
      setEditingRegistration(null);
      registrationForm.reset({
        profileId: "",
        status: "registered",
        amountPaid: 0,
        notes: "",
      });
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo actualizar la inscripción"),
  });

  const deleteRegistrationMutation = useMutation({
    mutationFn: ({
      eventId,
      registrationId,
    }: {
      eventId: string;
      registrationId: string;
    }) => deleteEventRegistration(eventId, registrationId),
    onSuccess: (message) => {
      toast.success(message);
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo eliminar la inscripción"),
  });

  const openCreateEventModal = () => {
    setEditingEvent(null);
    eventForm.reset({
      name: "",
      capacity: 50,
      date: "",
      time: "",
      place: "",
      price: 0,
      description: "",
      registrationDeadline: "",
      registrationClosed: false,
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event: Event) => {
    setEditingEvent(event);
    eventForm.reset({
      name: event.name,
      capacity: event.capacity,
      date: event.date.slice(0, 10),
      time: event.time,
      place: event.place,
      price: event.price,
      description: event.description ?? "",
      registrationDeadline: event.registrationDeadline?.slice(0, 10) ?? "",
      registrationClosed: event.registrationClosed,
    });
    setIsEventModalOpen(true);
  };

  const openCreateRegistrationModal = () => {
    if (selectedEvent?.registrationWindowClosed) {
      toast.error("Las inscripciones de este evento ya están cerradas");
      return;
    }

    setEditingRegistration(null);
    registrationForm.reset({
      profileId: "",
      status: "registered",
      amountPaid: 0,
      notes: "",
    });
    setIsRegistrationModalOpen(true);
  };

  const openEditRegistrationModal = (registration: EventRegistration) => {
    setEditingRegistration(registration);
    registrationForm.reset({
      profileId: registration.profile?._id ?? "",
      status: registration.status,
      amountPaid: registration.amountPaid,
      notes: registration.notes ?? "",
    });
    setIsRegistrationModalOpen(true);
  };

  const onSubmitEvent = eventForm.handleSubmit((values) => {
    const payload = {
      ...values,
      registrationDeadline: values.registrationDeadline || "",
    };

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent._id, payload });
      return;
    }

    createEventMutation.mutate(payload);
  });

  const onSubmitRegistration = registrationForm.handleSubmit((values) => {
    if (!selectedEvent) return;

    const amountPaid = Number(values.amountPaid ?? 0);

    if (amountPaid > selectedEvent.price) {
      toast.error("El valor pagado no puede superar el precio del evento");
      return;
    }

    if (editingRegistration) {
      updateRegistrationMutation.mutate({
        eventId: selectedEvent._id,
        registrationId: editingRegistration._id,
        payload: {
          status: values.status,
          amountPaid,
          notes: values.notes,
        },
      });
      return;
    }

    saveRegistrationMutation.mutate({
      eventId: selectedEvent._id,
      payload: {
        ...values,
        amountPaid,
      },
    });
  });

  const exportSelectedEventReport = () => {
    if (!selectedEvent) {
      toast.error("Selecciona un evento para exportar el informe");
      return;
    }

    const headers = [
      "Evento",
      "Persona",
      "Rol",
      "Documento",
      "Telefono",
      "Estado de pago",
      "Estado de inscripcion",
      "Valor evento",
      "Valor pagado",
      "Saldo pendiente",
      "Observaciones",
    ];

    const rows = selectedEvent.registrations.map((registration) => [
      selectedEvent.name,
      registration.profile
        ? formatFullName(registration.profile.firstName, registration.profile.lastName)
        : "Sin perfil",
      registration.profile?.role.name ?? "",
      registration.profile?.documentID ?? "",
      registration.profile?.phoneNumber ?? "",
      PAYMENT_STATUS_LABELS[registration.paymentStatus],
      REGISTRATION_STATUS_LABELS[registration.status],
      selectedEvent.price,
      registration.amountPaid,
      registration.balance,
      registration.notes ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `informe-${selectedEvent.name.replace(/[^\w\-]+/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Eventos</p>
            <h1 className="mt-3 text-3xl font-bold">Administra inscripción, recaudo, deuda y cupo según el evento seleccionado.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              El resumen superior cambia cuando eliges un evento de la agenda. También puedes cerrar
              inscripciones, exportar el informe del registro y ver cuánto falta para el cierre.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="bg-white font-semibold text-slate-950"
                startContent={<Plus className="h-4 w-4" />}
                onPress={openCreateEventModal}
              >
                Crear evento
              </Button>
              {selectedEvent ? (
                <>
                  <Button
                    variant="bordered"
                    className="border-white/20 bg-white/5 text-white"
                    startContent={<UserPlus className="h-4 w-4" />}
                    onPress={openCreateRegistrationModal}
                    isDisabled={selectedEvent.registrationWindowClosed}
                  >
                    Registrar persona
                  </Button>
                  <Button
                    variant="bordered"
                    className="border-white/20 bg-white/5 text-white"
                    startContent={<Download className="h-4 w-4" />}
                    onPress={exportSelectedEventReport}
                  >
                    Exportar informe
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Cierre de inscripciones</p>
              <p className="mt-3 text-2xl font-bold">{selectedEventStats.deadlineMessage}</p>
              <p className="mt-2 text-sm text-slate-300">
                {selectedEvent?.registrationDeadline
                  ? `Fecha límite: ${DATE_FORMATTER.format(new Date(selectedEvent.registrationDeadline))}`
                  : "Sin fecha límite definida"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Personas con deuda</p>
              <p className="mt-3 text-3xl font-bold">{selectedEventStats.debtors}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Recaudado</p>
              <p className="mt-3 text-2xl font-bold">{CURRENCY_FORMATTER.format(selectedEventStats.collected)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Saldo pendiente</p>
              <p className="mt-3 text-2xl font-bold">{CURRENCY_FORMATTER.format(selectedEventStats.pending)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Agenda</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Eventos creados</h2>
            </div>
            <CalendarDays className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando eventos...</p>
            ) : events.length ? (
              events.map((event) => {
                const isSelected = selectedEventId === event._id;

                return (
                  <button
                    key={event._id}
                    type="button"
                    onClick={() => setSelectedEventId(event._id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{event.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {DATE_FORMATTER.format(new Date(event.date))} · {event.time}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {event.summary.registeredCount}/{event.capacity}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {event.place}
                      </span>
                      <span className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-slate-400" />
                        {CURRENCY_FORMATTER.format(event.price)}
                      </span>
                      <span className="flex items-center gap-2">
                        {event.registrationWindowClosed ? <Lock className="h-4 w-4 text-slate-400" /> : <Unlock className="h-4 w-4 text-slate-400" />}
                        {event.registrationWindowClosed ? "Inscripción cerrada" : "Inscripción abierta"}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aún no hay eventos creados.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          {selectedEvent ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Detalle completo</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {DATE_FORMATTER.format(new Date(selectedEvent.date))}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {selectedEvent.time}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {selectedEvent.place}
                    </span>
                    <span className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-slate-400" />
                      {CURRENCY_FORMATTER.format(selectedEvent.price)} por persona
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="flat" startContent={<Edit3 className="h-4 w-4" />} onPress={() => openEditEventModal(selectedEvent)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<Trash2 className="h-4 w-4" />}
                    onPress={() => deleteEventMutation.mutate(selectedEvent._id)}
                    isLoading={deleteEventMutation.isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selectedEvent.description || "Sin descripción adicional para este evento."}
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Estado de inscripciones</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  <span>{selectedEvent.registrationWindowClosed ? "Cerradas" : "Abiertas"}</span>
                  <span>
                    {selectedEvent.registrationDeadline
                      ? `Límite: ${DATE_FORMATTER.format(new Date(selectedEvent.registrationDeadline))}`
                      : "Sin límite"}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ocupación</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.occupancyRate}%</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedEvent.summary.registeredCount}/{selectedEvent.capacity} cupos
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pago completo</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.paidInFullCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Personas al día</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Abonos</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.partialPaymentCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Pagos parciales</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Deuda activa</p>
                  <p className="mt-2 text-2xl font-bold text-rose-600">{selectedEvent.summary.debtCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Pendientes por cobrar</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recaudado</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {CURRENCY_FORMATTER.format(selectedEvent.summary.paidTotal)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Por cobrar</p>
                  <p className="mt-2 text-xl font-bold text-rose-600">
                    {CURRENCY_FORMATTER.format(selectedEvent.summary.pendingTotal)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Cancelados</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">{selectedEvent.summary.cancelledCount}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Inscritos</h3>
                  <p className="text-sm text-slate-500">
                    Puedes exportar el informe y ver fácilmente quién debe, quién abonó y quién pagó completo.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Download className="h-4 w-4" />}
                    onPress={exportSelectedEventReport}
                  >
                    Exportar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                    startContent={<UserPlus className="h-4 w-4" />}
                    onPress={openCreateRegistrationModal}
                    isDisabled={selectedEvent.registrationWindowClosed}
                  >
                    Agregar inscrito
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-3 py-3">Persona</th>
                      <th className="px-3 py-3">Pago</th>
                      <th className="px-3 py-3">Pagado</th>
                      <th className="px-3 py-3">Debe</th>
                      <th className="px-3 py-3">Inscripción</th>
                      <th className="px-3 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedEvent.registrations.length ? (
                      selectedEvent.registrations.map((registration) => (
                        <tr key={registration._id} className="align-top">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900">
                              {registration.profile
                                ? formatFullName(registration.profile.firstName, registration.profile.lastName)
                                : "Sin perfil"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {registration.profile?.role.name ?? "Sin rol"} · {registration.profile?.documentID ?? "Sin documento"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                PAYMENT_STATUS_STYLES[registration.paymentStatus]
                              }`}
                            >
                              {PAYMENT_STATUS_LABELS[registration.paymentStatus]}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-medium text-slate-700">
                            {CURRENCY_FORMATTER.format(registration.amountPaid)}
                          </td>
                          <td className="px-3 py-3 font-medium text-rose-600">
                            {CURRENCY_FORMATTER.format(registration.balance)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {REGISTRATION_STATUS_LABELS[registration.status]}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="flat" onPress={() => openEditRegistrationModal(registration)}>
                                Ajustar pago
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                onPress={() =>
                                  deleteRegistrationMutation.mutate({
                                    eventId: selectedEvent._id,
                                    registrationId: registration._id,
                                  })
                                }
                              >
                                Quitar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                          No hay personas inscritas todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              Selecciona un evento para ver su resumen, exportar el registro y controlar el cierre de inscripciones.
            </div>
          )}
        </article>
      </section>

      <Modal isOpen={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmitEvent}>
            <ModalHeader>{editingEvent ? "Editar evento" : "Crear evento"}</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Nombre del evento</label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Ejemplo: Retiro de parejas"
                  {...eventForm.register("name", { required: true })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Capacidad de personas</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("capacity", { valueAsNumber: true, required: true })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Valor por persona</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("price", { valueAsNumber: true, required: true })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Fecha del evento</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("date", { required: true })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Hora del evento</label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("time", { required: true })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Lugar del evento</label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Ejemplo: Auditorio principal"
                  {...eventForm.register("place", { required: true })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Fecha límite de inscripción</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("registrationDeadline")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Cierre manual de inscripciones</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...eventForm.register("registrationClosed", {
                      setValueAs: (value) => value === true || value === "true",
                    })}
                  >
                    <option value="false">Inscripciones abiertas</option>
                    <option value="true">Inscripciones cerradas</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Descripción o información adicional</label>
                <Textarea placeholder="Objetivo, indicaciones, qué incluye el pago, etc." {...eventForm.register("description")} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsEventModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                isLoading={createEventMutation.isPending || updateEventMutation.isPending}
              >
                {editingEvent ? "Guardar cambios" : "Crear evento"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal isOpen={isRegistrationModalOpen} onOpenChange={setIsRegistrationModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmitRegistration}>
            <ModalHeader>{editingRegistration ? "Ajustar pago e inscripción" : "Registrar inscrito"}</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Referencia del evento</p>
                <p className="mt-1">
                  Valor por persona: <span className="font-semibold">{CURRENCY_FORMATTER.format(selectedEvent?.price ?? 0)}</span>
                </p>
                <p className="mt-1">
                  Saldo proyectado con este registro: <span className="font-semibold">{CURRENCY_FORMATTER.format(remainingBalance)}</span>
                </p>
                {selectedEvent?.registrationWindowClosed ? (
                  <p className="mt-2 flex items-center gap-2 text-rose-600">
                    <Lock className="h-4 w-4" />
                    Este evento tiene las inscripciones cerradas.
                  </p>
                ) : null}
                {Number(watchedAmountPaid || 0) > (selectedEvent?.price ?? 0) ? (
                  <p className="mt-2 flex items-center gap-2 text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    El pago no puede superar el valor del evento.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Miembro o asistente</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  disabled={Boolean(editingRegistration)}
                  {...registrationForm.register("profileId", { required: true })}
                >
                  <option value="">Selecciona una persona</option>
                  {registrableMembers.map((member) => (
                    <option key={member._id} value={member._id}>
                      {formatFullName(member.firstName, member.lastName)} · {member.role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Estado de la inscripción</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...registrationForm.register("status", { required: true })}
                  >
                    <option value="registered">Activo</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Valor pagado por esta persona</label>
                  <input
                    type="number"
                    min={0}
                    max={selectedEvent?.price ?? 0}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    {...registrationForm.register("amountPaid", { valueAsNumber: true, required: true })}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-slate-900">Estado de pago resultante</p>
                <div className="mt-2 flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  {watchedStatus === "cancelled"
                    ? "Registro cancelado"
                    : remainingBalance === 0
                      ? "Pago completo"
                      : Number(watchedAmountPaid || 0) > 0
                        ? "Abonó, aún tiene saldo pendiente"
                        : "Debe el valor completo"}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Observaciones del pago o de la inscripción</label>
                <Textarea placeholder="Ejemplo: pagó primer abono en efectivo, necesita seguimiento, etc." {...registrationForm.register("notes")} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsRegistrationModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                isLoading={saveRegistrationMutation.isPending || updateRegistrationMutation.isPending}
                isDisabled={Boolean(selectedEvent?.registrationWindowClosed && !editingRegistration)}
              >
                {editingRegistration ? "Guardar ajuste" : "Guardar inscripción"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
