import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDate } from "@internationalized/date";
import { CalendarDays, Clock3, Edit3, Plus, Trash2, UserRound } from "lucide-react";
import { Button, DatePicker, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from "@heroui/react";
import { toast } from "react-toastify";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import { getAllMembers } from "@/api/MemberAPI";
import {
  createSermon,
  deleteSermon,
  getAllSermons,
  type CreateSermonData,
  type Sermon,
  updateSermon,
} from "@/api/SermonAPI";
import { extractDateOnly, parseStoredDate } from "@/utils/date";
import { formatFullName } from "@/utils/text";

type SermonFormValues = CreateSermonData;

const initialValues: SermonFormValues = {
  title: "",
  date: "",
  time: "",
  pastor: "",
  description: "",
};

export default function Sermons() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);
  const sermonForm = useForm<SermonFormValues>({ defaultValues: initialValues });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const { data: sermons = [], isLoading, isError, error } = useQuery({
    queryKey: ["sermons"],
    queryFn: getAllSermons,
  });

  const pastors = useMemo(
    () => members.filter((member) => member.role.name === "Pastor" && member.user?._id),
    [members],
  );

  const upcomingSermons = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sermons
      .filter((sermon) => parseStoredDate(sermon.date).getTime() >= today.getTime())
      .sort((left, right) => parseStoredDate(left.date).getTime() - parseStoredDate(right.date).getTime());
  }, [sermons]);

  const sortedSermons = useMemo(
    () => [...sermons].sort((left, right) => parseStoredDate(right.date).getTime() - parseStoredDate(left.date).getTime()),
    [sermons],
  );

  const invalidateSermons = () => {
    queryClient.invalidateQueries({ queryKey: ["sermons"] });
    queryClient.invalidateQueries({ queryKey: ["mySermons"] });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSermon(null);
    sermonForm.reset(initialValues);
  };

  const createMutation = useMutation({
    mutationFn: createSermon,
    onSuccess: () => {
      toast.success("Predica programada exitosamente");
      invalidateSermons();
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo programar la predica");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateSermonData> }) =>
      updateSermon(id, payload),
    onSuccess: () => {
      toast.success("Predica actualizada correctamente");
      invalidateSermons();
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo actualizar la predica");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSermon,
    onSuccess: () => {
      toast.success("Predica eliminada correctamente");
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo eliminar la predica");
    },
  });

  const openCreateModal = () => {
    setEditingSermon(null);
    sermonForm.reset(initialValues);
    setIsModalOpen(true);
  };

  const openEditModal = (sermon: Sermon) => {
    setEditingSermon(sermon);
    sermonForm.reset({
      title: sermon.title,
      date: extractDateOnly(sermon.date),
      time: sermon.time,
      pastor: sermon.pastor._id,
      description: sermon.description ?? "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteSermon = (sermon: Sermon) => {
    showSweetAlert({
      title: "Eliminar predica?",
      text: `Se eliminara "${sermon.title}" de la agenda.`,
      type: "warning",
      confirmButtonText: "Si, eliminar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(sermon._id);
        } catch {
          // handled in mutation
        }
      },
    });
  };

  const onSubmit = sermonForm.handleSubmit(async (values) => {
    try {
      if (editingSermon) {
        await updateMutation.mutateAsync({
          id: editingSermon._id,
          payload: values,
        });
        return;
      }

      await createMutation.mutateAsync(values);
    } catch {
      // handled in mutation
    }
  });

  if (isLoading) return <h1>Cargando predicas...</h1>;
  if (isError) return <h1>{error.message}</h1>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion de Predicas</h1>
          <p className="text-slate-600">
            Crea la predica y asigna el pastor desde el mismo formulario, igual que en cursos.
          </p>
        </div>
        <Button
          onPress={openCreateModal}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nueva predica
        </Button>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Agenda</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Proximas predicas</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {upcomingSermons.length} pendientes
            </span>
          </div>

          <div className="space-y-4">
            {upcomingSermons.length ? (
              upcomingSermons.map((sermon) => (
                <div key={sermon._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{sermon.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{sermon.description || "Sin descripcion adicional"}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {sermon.pastor?.name ?? "Pastor"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {parseStoredDate(sermon.date).toLocaleDateString("es-CO")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {sermon.time}
                    </div>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      {sermon.pastor?.name ?? "Pastor"}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="flat" startContent={<Edit3 className="h-4 w-4" />} onPress={() => openEditModal(sermon)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      startContent={<Trash2 className="h-4 w-4" />}
                      onPress={() => handleDeleteSermon(sermon)}
                      isLoading={deleteMutation.isPending}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                No hay predicas futuras registradas.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Historial</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Predicas registradas</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {sortedSermons.length} total
            </span>
          </div>

          <div className="space-y-3">
            {sortedSermons.length ? (
              sortedSermons.map((sermon) => (
                <div key={`${sermon._id}-history`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{sermon.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {parseStoredDate(sermon.date).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}{" "}
                        · {sermon.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {sermon.pastor?.name ?? "Pastor"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                Aun no hay predicas registradas.
              </div>
            )}
          </div>
        </article>
      </section>

      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmit}>
            <ModalHeader>{editingSermon ? "Editar predica" : "Crear predica"}</ModalHeader>
            <ModalBody className="space-y-3">
              <Input
                placeholder="Titulo de la predica"
                classNames={{
                  inputWrapper: "border-none shadow-none",
                  input: "focus:outline-none focus:ring-0",
                }}
                {...sermonForm.register("title", { required: true })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Controller
                  name="date"
                  control={sermonForm.control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <DatePicker
                      className="w-full"
                      classNames={{
                        inputWrapper: "border-none shadow-none",
                        input: "w-full rounded-xl focus:outline-none focus:ring-0",
                      }}
                      value={field.value ? parseDate(field.value) : null}
                      onChange={(value) => field.onChange(value ? value.toString() : "")}
                    />
                  )}
                />
                <Input
                  type="time"
                  classNames={{
                    inputWrapper: "border-none shadow-none",
                    input: "focus:outline-none focus:ring-0",
                  }}
                  {...sermonForm.register("time", { required: true })}
                />
              </div>
              <Controller
                name="pastor"
                control={sermonForm.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                    placeholder="Selecciona un pastor"
                  >
                    {pastors.map((pastor) => (
                      <SelectItem key={pastor.user!._id}>
                        {formatFullName(pastor.firstName, pastor.lastName)}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Textarea
                placeholder="Descripcion opcional"
                classNames={{
                  inputWrapper: "border-none shadow-none",
                  input: "focus:outline-none focus:ring-0",
                }}
                {...sermonForm.register("description")}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingSermon ? "Guardar cambios" : "Crear predica"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
