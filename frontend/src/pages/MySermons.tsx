import { useState } from "react";
import { BookOpen, CalendarDays, Clock, Edit3, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import { useAuth } from "@/lib/auth";
import {
  deleteSermon,
  getSermonsByPastor,
  type CreateSermonData,
  type Sermon,
  updateSermon,
} from "@/api/SermonAPI";

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
      date: sermon.date.slice(0, 10),
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
    return <p>Cargando usuario...</p>;
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
        <div>Cargando predicas...</div>
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
                  {new Date(sermon.date).toLocaleDateString("es-CO", {
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
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Titulo de la predica"
                {...sermonForm.register("title", { required: true })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  {...sermonForm.register("date", { required: true })}
                />
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  {...sermonForm.register("time", { required: true })}
                />
              </div>
              <Textarea placeholder="Descripcion opcional" {...sermonForm.register("description")} />
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
