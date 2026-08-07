import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDate } from "@internationalized/date";
import {
  BadgeDollarSign,
  CalendarDays,
  Clock3,
  Edit3,
  FileSpreadsheet,
  FileText,
  Lock,
  MapPin,
  Plus,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  DatePicker,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { toast } from "react-toastify";
import {
  createEvent,
  deleteEvent,
  deleteEventRegistration,
  exportEventRegistrations,
  getEventHistory,
  getEventsByStatus,
  type Event,
  type EventFormData,
  type EventRegistration,
  type EventRegistrationFormData,
  updateEvent,
  updateEventRegistration,
  upsertEventRegistration,
} from "@/api/EventAPI";
import { getAllMembers } from "@/api/MemberAPI";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { parseStoredDate } from "@/utils/date";
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

const REGISTRATION_STATUS_LABELS: Record<EventRegistration["status"], string> = {
  registered: "Registrado",
  cancelled: "Cancelado",
};

const PAYMENT_STATUS_LABELS: Record<EventRegistration["paymentStatus"], string> = {
  paid: "Pagado",
  partial: "Abono",
  pending: "Pendiente",
  cancelled: "Cancelado",
};

type EventTab = "upcoming" | "history";

const TABS: Array<{ id: EventTab; label: string }> = [
  { id: "upcoming", label: "Próximos eventos" },
  { id: "history", label: "Historial" },
];

const TAB_FOCUSABLE_KEYS = new Set([
  "ArrowRight", "Right",
  "ArrowLeft", "Left",
  "Home", "End",
]);

const handleTabKeyDown =
  (tabs: Array<{ id: EventTab }>, onChange: (id: EventTab) => void) =>
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!TAB_FOCUSABLE_KEYS.has(event.key)) return;
      const parent = event.currentTarget.parentElement;
      if (!parent) return;
      const buttons = Array.from(
        parent.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
      );
      const count = buttons.length;
      if (count === 0) return;
      const currentIndex = buttons.indexOf(event.currentTarget);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      switch (event.key) {
        case "ArrowRight":
        case "Right":
          nextIndex = (currentIndex + 1) % count;
          break;
        case "ArrowLeft":
        case "Left":
          nextIndex = (currentIndex - 1 + count) % count;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = count - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const target = buttons[nextIndex];
      if (!target) return;
      const targetId = target.id.replace(/^tab-/, "") as EventTab;
      const matched = tabs.find((tab) => tab.id === targetId);
      if (!matched) return;
      onChange(matched.id);
      target.focus();
    };

const triggerFileDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

const initialEventValues: EventFormData = {
  name: "",
  capacity: 50,
  date: "",
  time: "",
  place: "",
  price: 0,
  description: "",
  registrationDeadline: "",
  registrationClosed: false,
};

const initialRegistrationValues: EventRegistrationFormData = {
  profileId: "",
  status: "registered",
  amountPaid: 0,
  notes: "",
};

export default function Events() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<EventRegistration | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [memberDocumentFilter, setMemberDocumentFilter] = useState("");
  const [tab, setTab] = useState<EventTab>("upcoming");

  const eventForm = useForm<EventFormData>({ defaultValues: initialEventValues });
  const registrationForm = useForm<EventRegistrationFormData>({ defaultValues: initialRegistrationValues });

  const { data: upcomingEvents = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => getEventsByStatus("upcoming"),
  });

  const { data: pastEvents = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["events", "history"],
    queryFn: getEventHistory,
  });

  const events = tab === "upcoming" ? upcomingEvents : pastEvents;

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const availableMembers = useMemo(
    () => members.filter((member) => ["Asistente", "Miembro"].includes(member.role.name)),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const normalizedFilter = memberDocumentFilter.trim().toLowerCase();

    if (!normalizedFilter) {
      return availableMembers;
    }

    return availableMembers.filter((member) => {
      const fullName = formatFullName(member.firstName, member.lastName).toLowerCase();
      return member.documentID.toLowerCase().includes(normalizedFilter) || fullName.includes(normalizedFilter);
    });
  }, [availableMembers, memberDocumentFilter]);

  const selectedEvent = events.find((event) => event._id === selectedEventId) ?? events[0] ?? null;

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: ["events", "upcoming"] });
    queryClient.invalidateQueries({ queryKey: ["events", "history"] });
  };

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (event) => {
      toast.success("Evento creado correctamente");
      setIsEventModalOpen(false);
      setEditingEvent(null);
      eventForm.reset(initialEventValues);
      setSelectedEventId(event._id);
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo crear el evento"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EventFormData }) => updateEvent(id, payload),
    onSuccess: (event) => {
      toast.success("Evento actualizado correctamente");
      setIsEventModalOpen(false);
      setEditingEvent(null);
      eventForm.reset(initialEventValues);
      setSelectedEventId(event._id);
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo actualizar el evento"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success("Evento eliminado correctamente");
      setSelectedEventId(null);
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo eliminar el evento"),
  });

  const exportMutation = useMutation({
    mutationFn: exportEventRegistrations,
    onSuccess: (blob, eventId) => {
      const event = events.find((e) => e._id === eventId) ?? selectedEvent;
      const filename = event ? `inscritos-${event.name}.xlsx` : `inscritos-${eventId}.xlsx`;
      triggerFileDownload(blob, filename);
      toast.success("Descarga iniciada");
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo descargar el archivo"),
  });

  const saveRegistrationMutation = useMutation({
    mutationFn: (payload: EventRegistrationFormData) => {
      if (!selectedEvent) {
        throw new Error("Selecciona un evento");
      }

      if (editingRegistration) {
        return updateEventRegistration(selectedEvent._id, editingRegistration._id, {
          status: payload.status,
          amountPaid: payload.amountPaid,
          notes: payload.notes,
        });
      }

      return upsertEventRegistration(selectedEvent._id, payload);
    },
    onSuccess: () => {
      toast.success(editingRegistration ? "Inscripción actualizada correctamente" : "Inscripción creada correctamente");
      setIsRegistrationModalOpen(false);
      setEditingRegistration(null);
      registrationForm.reset(initialRegistrationValues);
      setMemberDocumentFilter("");
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo guardar la inscripción"),
  });

  const deleteRegistrationMutation = useMutation({
    mutationFn: (registrationId: string) => {
      if (!selectedEvent) {
        throw new Error("Selecciona un evento");
      }

      return deleteEventRegistration(selectedEvent._id, registrationId);
    },
    onSuccess: () => {
      toast.success("Inscripción eliminada correctamente");
      invalidateEvents();
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo eliminar la inscripción"),
  });

  const openCreateEventModal = () => {
    setEditingEvent(null);
    eventForm.reset(initialEventValues);
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event: Event) => {
    setEditingEvent(event);
    eventForm.reset({
      name: event.name,
      capacity: event.capacity,
      date: event.date,
      time: event.time,
      place: event.place,
      price: event.price,
      description: event.description ?? "",
      registrationDeadline: event.registrationDeadline ?? "",
      registrationClosed: event.registrationClosed,
    });
    setIsEventModalOpen(true);
  };

  const openCreateRegistrationModal = () => {
    setEditingRegistration(null);
    registrationForm.reset(initialRegistrationValues);
    setMemberDocumentFilter("");
    setIsRegistrationModalOpen(true);
  };

  const openEditRegistrationModal = (registration: EventRegistration) => {
    setEditingRegistration(registration);
    registrationForm.reset({
      profileId: registration.profile?._id ?? "",
      status: "registered",
      amountPaid: registration.amountPaid,
      notes: registration.notes ?? "",
    });
    setMemberDocumentFilter(registration.profile?.documentID ?? "");
    setIsRegistrationModalOpen(true);
  };

  const onSubmitEvent = eventForm.handleSubmit((values) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent._id, payload: values });
      return;
    }

    createMutation.mutate(values);
  });

  const onSubmitRegistration = registrationForm.handleSubmit((values) => {
    saveRegistrationMutation.mutate(values);
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Eventos</p>
            <h1 className="mt-3 text-3xl font-bold">Crea eventos y registra participantes desde administración.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              El admin controla cupos, valores y el estado de cada inscripción sin flujo de autogestión.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="bg-white font-semibold text-slate-950" startContent={<Plus className="h-4 w-4" />} onPress={openCreateEventModal}>
                Crear evento
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Eventos</p>
              <p className="mt-3 text-3xl font-bold">{events.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Activos</p>
              <p className="mt-3 text-3xl font-bold">{selectedEvent?.summary.registeredCount ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Evento activo</p>
              <p className="mt-3 text-2xl font-bold">{selectedEvent?.name ?? "Selecciona un evento"}</p>
              <p className="mt-2 text-sm text-slate-300">
                {selectedEvent
                  ? `${selectedEvent.summary.registeredCount} inscritos activos · ${selectedEvent.summary.availableSpots} cupos libres`
                  : "Selecciona un evento para administrar sus inscritos."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Agenda</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Eventos creados</h2>
            </div>
            <CalendarDays className="h-5 w-5 text-slate-400" />
          </div>

          <div
            role="tablist"
            aria-label="Secciones de eventos"
            aria-orientation="horizontal"
            className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            {TABS.map(({ id, label }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`tabpanel-${id}`}
                  id={`tab-${id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={handleTabKeyDown(TABS, setTab)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                    selected
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            {TABS.map(({ id }) => {
              const isCurrentTab = tab === id;
              const tabEvents = id === "upcoming" ? upcomingEvents : pastEvents;
              const tabLoading = id === "upcoming" ? isLoadingUpcoming : isLoadingHistory;
              return (
                <section
                  key={id}
                  id={`tabpanel-${id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${id}`}
                  hidden={!isCurrentTab}
                  className="space-y-3"
                >
                  {tabLoading ? (
                    <LoadingSpinner label="Cargando eventos..." className="min-h-[200px]" />
                  ) : tabEvents.length ? (
                    tabEvents.map((event) => (
                      <button
                        key={event._id}
                        type="button"
                        onClick={() => setSelectedEventId(event._id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${selectedEvent?._id === event._id
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{event.name}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {DATE_FORMATTER.format(parseStoredDate(event.date))} · {event.time}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {event.summary.registeredCount}/{event.capacity}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            {event.registrations.length} registros
                          </span>
                          <span className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-slate-400" />
                            {event.registrationWindowClosed ? "Inscripción cerrada" : "Inscripción abierta"}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      {id === "upcoming"
                        ? "Aún no hay próximos eventos."
                        : "Aún no hay eventos en el historial."}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          {selectedEvent ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Detalle</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {DATE_FORMATTER.format(parseStoredDate(selectedEvent.date))}
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
                      <FileText className="h-4 w-4 text-slate-400" />
                      {CURRENCY_FORMATTER.format(selectedEvent.price)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<UserPlus className="h-4 w-4" />}
                    onPress={openCreateRegistrationModal}
                    isDisabled={selectedEvent.isPast}
                    title={selectedEvent.isPast ? "No se pueden registrar personas en un evento pasado" : undefined}
                  >
                    Registrar persona
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 font-semibold text-white"
                    startContent={<FileSpreadsheet className="h-4 w-4" />}
                    onPress={() => exportMutation.mutate(selectedEvent._id)}
                    isLoading={exportMutation.isPending}
                  >
                    Descargar Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Edit3 className="h-4 w-4" />}
                    onPress={() => openEditEventModal(selectedEvent)}
                    isDisabled={selectedEvent.isPast}
                    title={selectedEvent.isPast ? "No se puede editar un evento pasado" : undefined}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<Trash2 className="h-4 w-4" />}
                    onPress={() => deleteMutation.mutate(selectedEvent._id)}
                    isLoading={deleteMutation.isPending}
                    isDisabled={selectedEvent.isPast}
                    title={selectedEvent.isPast ? "No se puede eliminar un evento pasado" : undefined}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Registrados</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.registeredCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pagados</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.paidInFullCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Abonos</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.partialPaymentCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pendientes</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedEvent.summary.debtCount}</p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-3 py-3">Persona</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Pago</th>
                      <th className="px-3 py-3">Observaciones</th>
                      <th className="px-3 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedEvent.registrations.length ? (
                      selectedEvent.registrations.map((registration) => (
                        <tr key={registration._id}>
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
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {REGISTRATION_STATUS_LABELS[registration.status]}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1 text-slate-600">
                              <p className="flex items-center gap-2">
                                <BadgeDollarSign className="h-4 w-4 text-slate-400" />
                                {CURRENCY_FORMATTER.format(registration.amountPaid)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {PAYMENT_STATUS_LABELS[registration.paymentStatus]} · Saldo {CURRENCY_FORMATTER.format(registration.balance)}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {registration.notes || "Sin observaciones"}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="flat" startContent={<Edit3 className="h-4 w-4" />} onPress={() => openEditRegistrationModal(registration)}>
                                Editar
                              </Button>
                              <Button size="sm" color="danger" variant="light" startContent={<XCircle className="h-4 w-4" />} onPress={() => deleteRegistrationMutation.mutate(registration._id)}>
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                          Aún no hay inscripciones en este evento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              Selecciona un evento para revisar sus inscripciones.
            </div>
          )}
        </article>
      </section>

      <Modal isOpen={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmitEvent}>
            <ModalHeader>{editingEvent ? "Editar evento" : "Crear evento"}</ModalHeader>
            <ModalBody className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nombre del evento</label>
                <Input placeholder="Nombre del evento" {...eventForm.register("name", { required: true })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Cupos</label>
                  <Input type="number" min={1} placeholder="Cupos" {...eventForm.register("capacity", { valueAsNumber: true, required: true })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Valor</label>
                  <Input type="number" min={0} placeholder="Valor" {...eventForm.register("price", { valueAsNumber: true, required: true })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
                  <Controller
                    name="date"
                    control={eventForm.control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <DatePicker value={field.value ? parseDate(field.value) : null} onChange={(value) => field.onChange(value ? value.toString() : "")} />
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Hora</label>
                  <Input type="time" {...eventForm.register("time", { required: true })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lugar</label>
                <Input placeholder="Lugar" {...eventForm.register("place", { required: true })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha límite de inscripción</label>
                <Controller
                  name="registrationDeadline"
                  control={eventForm.control}
                  render={({ field }) => (
                    <DatePicker value={field.value ? parseDate(field.value) : null} onChange={(value) => field.onChange(value ? value.toString() : "")} />
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
                <Textarea placeholder="Descripción" {...eventForm.register("description")} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsEventModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white" isLoading={createMutation.isPending || updateMutation.isPending}>
                {editingEvent ? "Guardar cambios" : "Crear evento"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal isOpen={isRegistrationModalOpen} onOpenChange={setIsRegistrationModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmitRegistration}>
            <ModalHeader>{editingRegistration ? "Editar inscripción" : "Registrar persona en el evento"}</ModalHeader>
            <ModalBody className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Persona por ID</label>
                <Controller
                  name="profileId"
                  control={registrationForm.control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Autocomplete
                      items={filteredMembers}
                      inputValue={memberDocumentFilter}
                      onInputChange={setMemberDocumentFilter}
                      selectedKey={field.value || null}
                      onSelectionChange={(key) => {
                        field.onChange(key);

                        const selectedOption = filteredMembers.find((member) => member._id === key);
                        setMemberDocumentFilter(
                          selectedOption ? formatFullName(selectedOption.firstName, selectedOption.lastName) : "",
                        );
                      }}
                      placeholder="Busca por nombre o ID"
                      isDisabled={Boolean(editingRegistration)}
                    >
                      {filteredMembers.map((member) => (
                        <AutocompleteItem key={member._id}>
                          {formatFullName(member.firstName, member.lastName)} · {member.documentID}
                        </AutocompleteItem>
                      ))}
                    </Autocomplete>
                  )}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Valor pagado</label>
                <Input type="number" min={0} placeholder="Valor pagado" {...registrationForm.register("amountPaid", { valueAsNumber: true, required: true })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Observaciones</label>
                <Textarea placeholder="Observaciones" {...registrationForm.register("notes")} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsRegistrationModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white" isLoading={saveRegistrationMutation.isPending}>
                {editingRegistration ? "Guardar cambios" : "Registrar persona"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
