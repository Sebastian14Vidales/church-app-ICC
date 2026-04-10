import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Textarea } from "@heroui/react"
import { HeartHandshake, MapPin, Plus, Users } from "lucide-react"
import ModalView from "@/components/dashboard/ModalView"
import { createLifeGroup, getMyLifeGroups } from "@/api/LifeGroupAPI"
import { useAuth } from "@/lib/auth"
import { type LifeGroupFormData } from "@/types/index"

const initialValues: LifeGroupFormData = {
    name: "",
    neighborhood: "",
    address: "",
}

export default function MyCoverage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<LifeGroupFormData>({
        defaultValues: initialValues,
    })

    const { data: lifeGroups = [], isLoading, isError, error } = useQuery({
        queryKey: ["lifeGroups"],
        queryFn: getMyLifeGroups,
    })

    const createMutation = useMutation({
        mutationFn: createLifeGroup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lifeGroups"] })
            setIsModalOpen(false)
            reset(initialValues)
        },
    })

    const onSubmit = async (formData: LifeGroupFormData) => {
        await createMutation.mutateAsync(formData)
    }

    if (isLoading) {
        return <h1>Cargando cobertura...</h1>
    }

    if (isError) {
        return <h1>{error.message}</h1>
    }

    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.28),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.20),_transparent_30%)]" />
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                            <HeartHandshake className="h-3.5 w-3.5" />
                            Mi cobertura
                        </div>
                        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
                            Supervisa tus grupos de vida desde un solo lugar.
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            {user?.name ?? "Supervisor"} puede registrar y consultar los grupos de vida
                            asociados a su cobertura.
                        </p>
                    </div>

                    <Button
                        className="bg-white font-semibold text-slate-950"
                        startContent={<Plus className="h-4 w-4" />}
                        onPress={() => setIsModalOpen(true)}
                    >
                        Agregar grupo de vida
                    </Button>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
                    <p className="text-sm font-medium text-slate-500">Grupos registrados</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{lifeGroups.length}</p>
                    <p className="mt-2 text-sm text-slate-500">
                        {lifeGroups.length === 1 ? "grupo activo" : "grupos activos"}
                    </p>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {lifeGroups.length ? (
                    lifeGroups.map((lifeGroup) => (
                        <article
                            key={lifeGroup._id}
                            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        Grupo de vida
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{lifeGroup.name}</h2>
                                </div>
                                <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                                    <Users className="h-5 w-5" />
                                </div>
                            </div>

                            <div className="mt-6 space-y-3 text-sm text-slate-600">
                                <p className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    Barrio: {lifeGroup.neighborhood}
                                </p>
                                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                                    Dirección: {lifeGroup.address}
                                </p>
                            </div>
                        </article>
                    ))
                ) : (
                    <article className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-200/70 xl:col-span-2">
                        <h2 className="text-2xl font-semibold text-slate-900">Aún no hay grupos de vida</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                            Usa el botón superior para crear el primer grupo de vida de tu cobertura.
                        </p>
                    </article>
                )}
            </section>

            <ModalView
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    reset(initialValues)
                }}
                title="Agregar grupo de vida"
            >
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <Input
                            {...register("name", { required: true })}
                            placeholder="Ej. Grupo Restauración Norte"
                            classNames={{ inputWrapper: "border-none shadow-none" }}
                        />
                        {errors.name ? <span className="text-xs text-red-500">Este campo es requerido</span> : null}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Barrio</label>
                        <Input
                            {...register("neighborhood", { required: true })}
                            placeholder="Ej. Ciudadela"
                            classNames={{ inputWrapper: "border-none shadow-none" }}
                        />
                        {errors.neighborhood ? <span className="text-xs text-red-500">Este campo es requerido</span> : null}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Dirección</label>
                        <Textarea
                            {...register("address", { required: true })}
                            placeholder="Escribe la dirección completa"
                        />
                        {errors.address ? <span className="text-xs text-red-500">Este campo es requerido</span> : null}
                    </div>

                    {createMutation.isError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {createMutation.error.message}
                        </div>
                    ) : null}

                    <Button
                        type="submit"
                        color="primary"
                        className="w-full"
                        isLoading={createMutation.isPending}
                    >
                        Guardar grupo de vida
                    </Button>
                </form>
            </ModalView>
        </div>
    )
}
