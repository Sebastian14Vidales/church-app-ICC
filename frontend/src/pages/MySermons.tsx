import { useState } from "react";
import { parseDate } from "@internationalized/date";
import { BookOpen, CalendarDays, Clock, Edit3, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, DatePicker, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import {
  deleteSermon,
  getSermonsByPastor,
  type CreateSermonData,
  type Sermon,
  updateSermon,
} from "@/api/SermonAPI";
import { extractDateOnly, parseStoredDate, START_TIME_OPTIONS } from "@/utils/date";

type SermonFormValues = Pick<CreateSermonData, "title" | "date" | "time" | "description">;

export default function MySermons() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);

  const sermonForm = useForm<SermonFormValues>({
    defaultValues: {
      title: "",
      date: "",
      time: "",
      description: "",
    },
  });

  const { data: sermons = [], isLoading } = useQuery({
    queryKey: ["mySermons", user?.profileId ?? user?.id],
    queryFn: () => getSermonsByPastor(user?.profileId ?? user!.id),
    enabled: Boolean(user?.profileId ?? user?.id),
  });

  const invalidateSermons = () => {
    queryClient.invalidateQueries({ queryKey: ["mySermons"] });
    queryClient.invalidateQueries({ queryKey: ["sermons"] });
  };

  const updateSermonMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateSermonData> }) =>
      updateSermon(id, payload),
    onSuccess: () => {
      toast.success("Predica actualizada correctamente");
      setIsModalOpen(false);
      setEditingSermon(null);
      sermonForm.reset();
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo actualizar la predica");
    },
  });

  const deleteSermonMutation = useMutation({
    mutationFn: deleteSermon,
    onSuccess: () => {
      toast.success("Predica eliminada correctamente");
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo eliminar la predica");
    },
  });

  const openEditModal = (sermon: Sermon) => {
    setEditingSermon(sermon);
    sermonForm.reset({
      title: sermon.title,
      date: extractDateOnly(sermon.date),
      time: sermon.time,
      description: sermon.description ?? "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSermon(null);
    sermonForm.reset();
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
          await deleteSermonMutation.mutateAsync(sermon._id);
        } catch {
          // handled by mutation
        }
      },
    });
  };

  const onSubmit = sermonForm.handleSubmit((values) => {
    if (!editingSermon) return;

    updateSermonMutation.mutate({
      id: editingSermon._id,
      payload: {
        ...values,
        pastor: editingSermon.pastor._id,
      },
    });
  });

  if (!user) {
    return <LoadingSpinner label="Cargando usuario..." className="min-h-screen" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mis Predicas</h1>
          <p className="text-sm text-slate-600">Aqui veras las predicas agendadas a tu nombre.</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Cargando predicas..." className="min-h-[200px]" />
      ) : sermons.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm shadow-slate-200/70">
          <p className="text-lg font-semibold">Aun no tienes predicas agendadas</p>
          <p className="mt-2 text-sm">Cuando el administrador programe una predica, aparecera aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sermons.map((sermon) => (
            <div key={sermon._id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{sermon.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{sermon.description || "Sin descripcion adicional"}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {sermon.pastor?.name ?? "Pastor"}
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {parseStoredDate(sermon.date).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {sermon.time}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Edit3 className="h-4 w-4" />}
                  onPress={() => openEditModal(sermon)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  startContent={<Trash2 className="h-4 w-4" />}
                  onPress={() => handleDeleteSermon(sermon)}
                  isLoading={deleteSermonMutation.isPending}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
        <p className="text-sm">Desde aqui tambien puedes ajustar el titulo, fecha, hora o eliminar una predica si ya no se realizara.</p>
      </div>

      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent>
          <form onSubmit={onSubmit}>
            <ModalHeader>Editar predica</ModalHeader>
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
                <Controller
                  name="time"
                  control={sermonForm.control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select
                      selectedKeys={field.value ? [field.value] : []}
                      onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                      placeholder="Selecciona una hora"
                      aria-label="Hora"
                      className="w-full"
                    >
                      {START_TIME_OPTIONS.map((option) => (
                        <SelectItem key={option.value}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  )}
                />
              </div>
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
                isLoading={updateSermonMutation.isPending}
              >
                Guardar cambios
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
