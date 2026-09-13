import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, DatePicker, Input, SelectItem, Textarea } from "@heroui/react";
import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { Coins, Edit3, Plus, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import { addSession, deleteSession, getMyLifeGroups, updateLifeGroupAttendees, updateSession } from "@/api/LifeGroupAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import FormSelect from "@/components/common/FormSelect";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ModalView from "@/components/dashboard/ModalView";
import { useAuth } from "@/hooks/useAuth";
import { type LifeGroupSession, type Member, type SessionFormData } from "@/types/index";
import { areArraysEqual } from "@/utils/array";
import { parseStoredDate } from "@/utils/date";
import { formatFullName, getInitials } from "@/utils/text";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const GROUP_TYPE_LABELS: Record<"life-group" | "couple-group", string> = {
  "life-group": "Grupo de vida",
  "couple-group": "Grupo de pareja",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const initialSessionValues: SessionFormData = {
  date: "",
  attendeesPresent: [],
  offeringAmount: 0,
  notes: "",
};

const sessionToFormData = (session: LifeGroupSession): SessionFormData => ({
  date: session.date,
  attendeesPresent: session.attendeesPresent.map((attendee) => attendee._id),
  offeringAmount: session.offeringAmount,
  notes: session.notes ?? "",
});

const isAttendee = (member: Member) => ["Asistente", "Miembro"].includes(member.role.name);

type AttendeesFormData = {
  attendees: string[];
};

export default function MyLifeGroup() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LifeGroupSession | null>(null);
  const [isEditingAttendees, setIsEditingAttendees] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SessionFormData>({ defaultValues: initialSessionValues });

  const {
    control: attendeesControl,
    handleSubmit: handleAttendeesSubmit,
    reset: resetAttendees,
  } = useForm<AttendeesFormData>({ defaultValues: { attendees: [] } });

  const { data: lifeGroups = [], isLoading } = useQuery({
    queryKey: ["lifeGroups"],
    queryFn: getMyLifeGroups,
  });

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const group = lifeGroups[0] ?? null;
  const eligibleMembers = members.filter(isAttendee);

  const addSessionMutation = useMutation({
    mutationFn: (data: SessionFormData) => {
      if (!group) throw new Error("No hay un grupo seleccionado");
      return addSession(group._id, data);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: SessionFormData }) => {
      if (!group) throw new Error("No hay un grupo seleccionado");
      return updateSession(group._id, sessionId, data);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => {
      if (!group) throw new Error("No hay un grupo seleccionado");
      return deleteSession(group._id, sessionId);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateAttendeesMutation = useMutation({
    mutationFn: (attendeeIds: string[]) => {
      if (!group) throw new Error("No hay un grupo seleccionado");
      return updateLifeGroupAttendees(group._id, attendeeIds);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
      setIsEditingAttendees(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingSession(null);
    reset(initialSessionValues);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: LifeGroupSession) => {
    setEditingSession(session);
    reset(sessionToFormData(session));
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingSession(null);
    reset(initialSessionValues);
  };

  const handleStartEditAttendees = () => {
    resetAttendees({ attendees: group?.attendees.map((attendee) => attendee._id) ?? [] });
    setIsEditingAttendees(true);
  };

  const handleCancelEditAttendees = () => {
    setIsEditingAttendees(false);
    resetAttendees();
  };

  const onAttendeesSubmit = (data: AttendeesFormData) => {
    if (!group) return;

    const currentIds = group.attendees.map((attendee) => attendee._id);
    if (areArraysEqual(currentIds, data.attendees)) {
      toast.info("No hay cambios para guardar");
      setIsEditingAttendees(false);
      return;
    }

    updateAttendeesMutation.mutate(data.attendees);
  };

  const handleDelete = (session: LifeGroupSession) => {
    if (!group) return;
    showSweetAlert({
      title: "Eliminar sesión?",
      text: `Se eliminará la sesión ${session.weekNumber}. Esta acción no se puede deshacer.`,
      type: "warning",
      confirmButtonText: "Sí, eliminar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      onConfirm: async () => {
        try {
          await deleteSessionMutation.mutateAsync(session._id);
        } catch {
          // Los errores ya se manejan en la mutación
        }
      },
    });
  };

  const onSubmit = (data: SessionFormData) => {
    if (editingSession) {
      updateSessionMutation.mutate({ sessionId: editingSession._id, data });
      return;
    }
    addSessionMutation.mutate(data);
  };

  if (isLoading) {
    return <LoadingSpinner label="Cargando grupo de vida..." className="min-h-[40vh]" />;
  }

  if (!group) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
        Aún no tienes un grupo de vida asignado.
      </div>
    );
  }

  const totalOfferings = group.sessions.reduce((sum, session) => sum + session.offeringAmount, 0);

  const canManageAttendees = (() => {
    if (!user) return false;

    const isAdmin = user.roles.includes("Admin") || user.roles.includes("Superadmin");
    const isGroupOwner = Boolean(
      user.profileId &&
        (user.profileId === group.leader._id || user.profileId === group.supervisor._id),
    );
    // Fallback para líderes/supervisores cuya sesión no tenga profileId poblado:
    // se muestra el botón y el backend responde 403 si no pertenece al grupo.
    const isLeaderOrSupervisorWithoutProfile =
      (user.roles.includes("Lider") || user.roles.includes("Supervisor")) && !user.profileId;

    return isAdmin || isGroupOwner || isLeaderOrSupervisorWithoutProfile;
  })();

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Mi grupo</p>
            <h1 className="mt-3 text-3xl font-bold">{group.name}</h1>
            <p className="mt-2 text-slate-300">{GROUP_TYPE_LABELS[group.type]}</p>
            <p className="mt-1 text-sm text-slate-400">
              {group.neighborhood} · {group.address}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Semanas</p>
              <p className="mt-3 text-3xl font-bold">{group.sessions.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Ofrendas</p>
              <p className="mt-3 text-lg font-bold">{CURRENCY_FORMATTER.format(totalOfferings)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Asistentes</p>
              <p className="mt-3 text-3xl font-bold">{group.attendees.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Asistentes</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Roster del grupo</h2>
          </div>
          {canManageAttendees && !isEditingAttendees && (
            <Button
              className="rounded-lg bg-blue-600 font-semibold text-white"
              startContent={<Users className="h-4 w-4" />}
              onPress={handleStartEditAttendees}
            >
              Editar asistentes
            </Button>
          )}
        </div>

        {isEditingAttendees ? (
          <form onSubmit={handleAttendeesSubmit(onAttendeesSubmit)} noValidate className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Selecciona los asistentes
              </label>
              <FormSelect
                name="attendees"
                control={attendeesControl}
                selectionMode="multiple"
                placeholder="Busca y selecciona miembros"
                aria-label="Asistentes del grupo"
                className="w-full"
                isDisabled={isLoadingMembers}
              >
                {eligibleMembers.map((member) => (
                  <SelectItem key={member._id}>
                    {formatFullName(member.firstName, member.lastName)}
                  </SelectItem>
                ))}
              </FormSelect>
              <p className="mt-1 text-xs text-slate-500">
                Solo se muestran miembros con rol Asistente o Miembro.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                color="primary"
                isLoading={updateAttendeesMutation.isPending}
                className="rounded-lg font-semibold"
              >
                Guardar asistentes
              </Button>
              <Button
                type="button"
                variant="flat"
                onPress={handleCancelEditAttendees}
                className="rounded-lg"
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6">
            {group.attendees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                Aún no hay asistentes en el grupo. Agrega los asistentes para poder registrar sesiones con asistencia.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.attendees.map((attendee) => (
                  <div
                    key={attendee._id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {getInitials(formatFullName(attendee.firstName, attendee.lastName))}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {formatFullName(attendee.firstName, attendee.lastName)}
                      </p>
                      <p className="text-xs text-slate-500">{attendee.documentID}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm text-slate-500">
              Total: {group.attendees.length} asistente{group.attendees.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Sesiones</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Historial de reuniones</h2>
          </div>
          <Button
            className="rounded-lg bg-blue-600 font-semibold text-white"
            startContent={<Plus className="h-4 w-4" />}
            onPress={handleOpenCreate}
          >
            Registrar sesión
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {group.sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
              Aún no hay sesiones registradas.
            </div>
          ) : (
            [...group.sessions]
              .sort((left, right) => right.weekNumber - left.weekNumber)
              .map((session) => (
                <div
                  key={session._id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Semana {session.weekNumber} · {DATE_FORMATTER.format(parseStoredDate(session.date))}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        {session.attendeesPresent.length} / {group.attendees.length} presentes
                      </span>
                      <span className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-slate-400" />
                        {CURRENCY_FORMATTER.format(session.offeringAmount)}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="mt-2 text-sm text-slate-500">{session.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Edit3 className="h-4 w-4" />}
                      onPress={() => handleOpenEdit(session)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      startContent={<Trash2 className="h-4 w-4" />}
                      onPress={() => handleDelete(session)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      <ModalView
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingSession ? "Editar sesión" : "Registrar sesión"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="session-date" className="block text-sm font-medium text-slate-700">Fecha</label>
              <Controller
                name="date"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <DatePicker
                    id="session-date"
                    value={field.value ? parseDate(field.value.split("T")[0]) : null}
                    onChange={(value) =>
                      field.onChange(value ? value.toDate(getLocalTimeZone()).toISOString() : "")
                    }
                    aria-label="Fecha de la sesión"
                    className="w-full"
                  />
                )}
              />
              {errors.date && <span className="text-xs text-red-500">Este campo es requerido</span>}
            </div>

            <div>
              <label htmlFor="session-attendees" className="block text-sm font-medium text-slate-700">Asistentes presentes</label>
              <FormSelect
                name="attendeesPresent"
                control={control}
                selectionMode="multiple"
                placeholder="Selecciona los asistentes presentes"
                aria-label="Asistentes presentes"
                className="w-full"
              >
                {group.attendees.map((attendee) => (
                  <SelectItem key={attendee._id}>
                    {formatFullName(attendee.firstName, attendee.lastName)}
                  </SelectItem>
                ))}
              </FormSelect>
            </div>

            <div>
              <label htmlFor="session-offering" className="block text-sm font-medium text-slate-700">Ofrenda</label>
              <Input
                id="session-offering"
                type="number"
                min={0}
                step="any"
                {...register("offeringAmount", { valueAsNumber: true, required: true, min: 0 })}
                placeholder="Valor de la ofrenda"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
              {errors.offeringAmount && (
                <span className="text-xs text-red-500">La ofrenda debe ser mayor o igual a 0</span>
              )}
            </div>

            <div>
              <label htmlFor="session-notes" className="block text-sm font-medium text-slate-700">Notas</label>
              <Textarea
                id="session-notes"
                {...register("notes")}
                placeholder="Observaciones de la sesión"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
            </div>
          </div>

          <Button
            type="submit"
            color="primary"
            isLoading={addSessionMutation.isPending || updateSessionMutation.isPending}
            className="my-6 w-full text-sm font-bold uppercase"
          >
            {editingSession ? "Guardar cambios" : "Registrar sesión"}
          </Button>
        </form>
      </ModalView>
    </div>
  );
}
