import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, SelectItem } from "@heroui/react";
import { Heart, Pencil, Plus, Users } from "lucide-react";
import { toast } from "react-toastify";
import { createLifeGroup, getMyLifeGroups, updateLifeGroup } from "@/api/LifeGroupAPI";
import { getAllMembers } from "@/api/MemberAPI";
import FormSelect from "@/components/common/FormSelect";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ModalView from "@/components/dashboard/ModalView";
import { useAuth } from "@/hooks/useAuth";
import { type LifeGroup, type LifeGroupFormData, type Member } from "@/types/index";
import { formatFullName } from "@/utils/text";

const GROUP_TYPE_LABELS: Record<LifeGroupFormData["type"], string> = {
  "life-group": "Grupo de vida",
  "couple-group": "Grupo de pareja",
};

const initialFormValues: LifeGroupFormData = {
  name: "",
  neighborhood: "",
  address: "",
  leader: "",
  type: "life-group",
};

const isLider = (member: Member) =>
  member.role.name === "Lider" || member.user?.roles?.some((role) => role.name === "Lider");

const isSupervisor = (member: Member) =>
  member.role.name === "Supervisor" || member.user?.roles?.some((role) => role.name === "Supervisor");

export default function MyCoverage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LifeGroup | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdminUser = user?.roles.includes("Admin") || user?.roles.includes("Superadmin");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LifeGroupFormData>({ defaultValues: initialFormValues });

  const { data: lifeGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["lifeGroups"],
    queryFn: getMyLifeGroups,
  });

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const leaders = members.filter(isLider);
  const supervisors = members.filter(isSupervisor);

  const createMutation = useMutation({
    mutationFn: createLifeGroup,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: LifeGroupFormData }) =>
      updateLifeGroup(id, formData),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["lifeGroups"] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleOpenCreate = () => {
    setEditingGroup(null);
    reset(initialFormValues);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: LifeGroup) => {
    setEditingGroup(group);
    reset({
      name: group.name,
      neighborhood: group.neighborhood,
      address: group.address,
      leader: group.leader._id,
      supervisor: group.supervisor._id,
      type: group.type,
    });
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    reset(initialFormValues);
  };

  const onSubmit = (formData: LifeGroupFormData) => {
    const payload = isAdminUser ? formData : { ...formData, supervisor: undefined };

    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup._id, formData: payload });
      return;
    }
    createMutation.mutate(payload);
  };

  if (isLoadingGroups || isLoadingMembers) {
    return <LoadingSpinner label="Cargando cobertura..." className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi cobertura</h1>
          <p className="text-slate-600">Gestiona los grupos de vida bajo tu cuidado</p>
        </div>
        <Button
          onPress={handleOpenCreate}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nuevo grupo de vida
        </Button>
      </div>

      {lifeGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          Aún no tienes grupos de vida registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {lifeGroups.map((group) => (
            <div
              key={group._id}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                  <p className="text-sm text-slate-500">{group.neighborhood}</p>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={() => handleOpenEdit(group)}
                  aria-label="Editar grupo"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p>{group.address}</p>
                <p>
                  <span className="font-medium">Tipo:</span> {GROUP_TYPE_LABELS[group.type]}
                </p>
                <p>
                  <span className="font-medium">Líder:</span>{" "}
                  {formatFullName(group.leader.firstName, group.leader.lastName)}
                </p>
                <p>
                  <span className="font-medium">Supervisor:</span>{" "}
                  {formatFullName(group.supervisor.firstName, group.supervisor.lastName)}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  {group.attendees.length} asistentes
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-slate-400" />
                  {group.sessions.length} sesiones
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalView
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingGroup ? "Editar grupo de vida" : "Nuevo grupo de vida"}
        size="2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="coverage-name" className="block text-sm font-medium text-slate-700">Nombre</label>
              <Input
                id="coverage-name"
                {...register("name", { required: true })}
                placeholder="Nombre del grupo"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
              {errors.name && <span className="text-xs text-red-500">Este campo es requerido</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="coverage-neighborhood" className="block text-sm font-medium text-slate-700">Barrio</label>
                <Input
                  id="coverage-neighborhood"
                  {...register("neighborhood", { required: true })}
                  placeholder="Barrio o sector"
                  classNames={{ inputWrapper: "border-none shadow-none" }}
                />
                {errors.neighborhood && (
                  <span className="text-xs text-red-500">Este campo es requerido</span>
                )}
              </div>
              <div>
                <label htmlFor="coverage-address" className="block text-sm font-medium text-slate-700">Dirección</label>
                <Input
                  id="coverage-address"
                  {...register("address", { required: true })}
                  placeholder="Dirección de reunión"
                  classNames={{ inputWrapper: "border-none shadow-none" }}
                />
                {errors.address && <span className="text-xs text-red-500">Este campo es requerido</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="coverage-type" className="block text-sm font-medium text-slate-700">Tipo de grupo</label>
                <FormSelect
                  name="type"
                  control={control}
                  rules={{ required: true }}
                  placeholder="Selecciona el tipo"
                  aria-label="Tipo de grupo"
                  className="w-full"
                >
                  <SelectItem key="life-group">Grupo de vida</SelectItem>
                  <SelectItem key="couple-group">Grupo de pareja</SelectItem>
                </FormSelect>
                {errors.type && <span className="text-xs text-red-500">Este campo es requerido</span>}
              </div>
              <div>
                <label htmlFor="coverage-leader" className="block text-sm font-medium text-slate-700">Líder</label>
                <FormSelect
                  name="leader"
                  control={control}
                  rules={{ required: true }}
                  placeholder="Selecciona un líder"
                  aria-label="Líder"
                  className="w-full"
                >
                  {leaders.map((leader) => (
                    <SelectItem key={leader._id}>
                      {formatFullName(leader.firstName, leader.lastName)}
                    </SelectItem>
                  ))}
                </FormSelect>
                {errors.leader && <span className="text-xs text-red-500">Este campo es requerido</span>}
              </div>
            </div>

            {isAdminUser && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="coverage-supervisor" className="block text-sm font-medium text-slate-700">Supervisor responsable</label>
                  <FormSelect
                    name="supervisor"
                    control={control}
                    rules={{ required: isAdminUser }}
                    placeholder="Selecciona el supervisor"
                    aria-label="Supervisor responsable"
                    className="w-full"
                  >
                    {supervisors.map((supervisor) => (
                      <SelectItem key={supervisor._id}>
                        {formatFullName(supervisor.firstName, supervisor.lastName)}
                      </SelectItem>
                    ))}
                  </FormSelect>
                  {errors.supervisor && <span className="text-xs text-red-500">Este campo es requerido</span>}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Los asistentes los gestiona el líder desde "Mi grupo de vida" una vez asignado.
            </p>
          </div>

          <Button
            type="submit"
            color="primary"
            isLoading={createMutation.isPending || updateMutation.isPending}
            className="my-6 w-full text-sm font-bold uppercase"
          >
            {editingGroup ? "Guardar cambios" : "Crear grupo"}
          </Button>
        </form>
      </ModalView>
    </div>
  );
}
