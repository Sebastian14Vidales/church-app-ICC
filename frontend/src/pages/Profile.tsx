import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Shield, User, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { changePassword, getCurrentSession } from "@/api/AuthAPI";
import PasswordField from "@/components/auth/PasswordField";
import { useAuth } from "@/lib/auth";

type ChangePasswordFormData = {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

const initialValues: ChangePasswordFormData = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
}

export default function Profile() {
    const { user } = useAuth()
    const [isChangingPassword, setIsChangingPassword] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
        watch,
    } = useForm<ChangePasswordFormData>({
        defaultValues: initialValues,
    })

    const newPassword = watch("newPassword")

    // Verificar estado de la sesión
    const sessionCheckMutation = useMutation({
        mutationFn: getCurrentSession,
        onSuccess: () => {
            toast.success("Sesión verificada correctamente")
        },
        onError: () => {
            toast.error("Tu sesión ha expirado. Serás redirigido al login.")
        },
    })

    const changePasswordMutation = useMutation({
        mutationFn: changePassword,
        onSuccess: () => {
            toast.success("Contraseña cambiada exitosamente")
            reset()
            setIsChangingPassword(false)
        },
        onError: (error: any) => {
            // Si es error 401, el interceptor ya maneja el logout automático
            if (error.message?.includes("expiró") || error.message?.includes("inválida")) {
                toast.error("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.")
            } else {
                toast.error(error.message || "Error al cambiar la contraseña")
            }
        },
    })

    const onSubmit = async (formData: ChangePasswordFormData) => {
        await changePasswordMutation.mutateAsync({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-amber-600" />
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">Mi Perfil</h1>
                    <p className="text-stone-600">Gestiona tu información personal y seguridad</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Información del Usuario */}
                <Card className="border border-stone-200">
                    <CardHeader className="flex flex-row items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                            <User className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-stone-900">Información Personal</h3>
                            <p className="text-sm text-stone-600">Datos de tu cuenta</p>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700">Nombre</label>
                            <Input
                                value={user?.name || ""}
                                readOnly
                                variant="bordered"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700">Correo Electrónico</label>
                            <Input
                                value={user?.email || ""}
                                readOnly
                                variant="bordered"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700">Estado de la Cuenta</label>
                            <div className="mt-1 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                                        <Shield className="h-3 w-3 text-green-600" />
                                    </div>
                                    <span className="text-sm text-stone-600">Cuenta activa y verificada</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="light"
                                    onClick={() => sessionCheckMutation.mutate()}
                                    isLoading={sessionCheckMutation.isPending}
                                    startContent={<Clock className="h-4 w-4" />}
                                >
                                    Verificar Sesión
                                </Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Cambio de Contraseña */}
                <Card className="border border-stone-200">
                    <CardHeader className="flex flex-row items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                            <KeyRound className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-stone-900">Cambiar Contraseña</h3>
                            <p className="text-sm text-stone-600">Actualiza tu contraseña de acceso</p>
                            <p className="text-xs text-amber-600 mt-1">
                                💡 Las sesiones expiran automáticamente después de 1 hora
                            </p>
                        </div>
                        <Button
                            variant="light"
                            size="sm"
                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                        >
                            {isChangingPassword ? "Cancelar" : "Cambiar"}
                        </Button>
                    </CardHeader>
                    <CardBody>
                        {isChangingPassword ? (
                            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                                <div>
                                    <PasswordField
                                        label="Contraseña actual"
                                        variant="bordered"
                                        radius="lg"
                                        {...register("currentPassword", {
                                            required: "La contraseña actual es obligatoria",
                                        })}
                                    />
                                    {errors.currentPassword && (
                                        <p className="mt-1 text-sm text-red-500">{errors.currentPassword.message}</p>
                                    )}
                                </div>

                                <div>
                                    <PasswordField
                                        label="Nueva contraseña"
                                        variant="bordered"
                                        radius="lg"
                                        {...register("newPassword", {
                                            required: "La nueva contraseña es obligatoria",
                                            minLength: {
                                                value: 8,
                                                message: "La contraseña debe tener al menos 8 caracteres",
                                            },
                                        })}
                                    />
                                    {errors.newPassword && (
                                        <p className="mt-1 text-sm text-red-500">{errors.newPassword.message}</p>
                                    )}
                                </div>

                                <div>
                                    <PasswordField
                                        label="Confirmar nueva contraseña"
                                        variant="bordered"
                                        radius="lg"
                                        {...register("confirmPassword", {
                                            required: "Debes confirmar la contraseña",
                                            validate: (value) =>
                                                value === newPassword || "Las contraseñas no coinciden",
                                        })}
                                    />
                                    {errors.confirmPassword && (
                                        <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="submit"
                                        isLoading={changePasswordMutation.isPending}
                                        className="flex-1 bg-[linear-gradient(135deg,#ca8a04_0%,#ea580c_100%)] text-white"
                                    >
                                        Cambiar Contraseña
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="bordered"
                                        onClick={() => {
                                            reset()
                                            setIsChangingPassword(false)
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="text-center py-8">
                                <KeyRound className="mx-auto h-12 w-12 text-stone-400" />
                                <p className="mt-4 text-stone-600">
                                    Haz clic en "Cambiar" para actualizar tu contraseña
                                </p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    )
}