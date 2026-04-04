import { Button, Card, CardBody, CardHeader } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { BadgeCheck, KeyRound, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { confirmAccount } from "@/api/AuthAPI"
import PasswordField from "@/components/auth/PasswordField"
import PATHS from "@/utils/constants/routes"

type ConfirmAccountFormData = {
    password: string
    confirmPassword: string
}

const initialValues: ConfirmAccountFormData = {
    password: "",
    confirmPassword: "",
}

export default function ConfirmAccountAccess() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token") ?? ""
    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<ConfirmAccountFormData>({
        defaultValues: initialValues,
    })

    const password = watch("password")
    const confirmMutation = useMutation({
        mutationFn: confirmAccount,
    })

    const onSubmit = async (formData: ConfirmAccountFormData) => {
        await confirmMutation.mutateAsync({
            token,
            password: formData.password,
        })

        navigate(PATHS.login, { replace: true })
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.18),_transparent_34%),linear-gradient(180deg,_#fff9ef_0%,_#f6efe2_48%,_#efe2cf_100%)] px-4 py-10">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
                <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="flex flex-col justify-center rounded-[32px] border border-white/70 bg-white/65 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur md:p-12">
                        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-[26px] bg-white shadow-[0_18px_40px_rgba(120,53,15,0.12)]">
                            <img
                                src="/logoICC.jpg"
                                alt="Iglesia Casa de Dios - Cruzada Cristiana"
                                className="h-12 w-12 object-contain"
                            />
                        </div>

                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-700">
                            Activación de acceso
                        </p>
                        <h1 className="max-w-xl font-serif text-4xl leading-tight text-stone-900 md:text-5xl">
                            Iglesia Casa de Dios - Cruzada Cristiana
                        </h1>
                        <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 md:text-lg">
                            Define tu contraseña final para terminar la activación segura de tu cuenta.
                        </p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <BadgeCheck className="mb-3 h-5 w-5 text-amber-700" />
                                <p className="text-sm font-semibold text-stone-800">Enlace firmado</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    El acceso llega protegido y con vencimiento automático.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <KeyRound className="mb-3 h-5 w-5 text-orange-700" />
                                <p className="text-sm font-semibold text-stone-800">Contraseña final</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Configura la clave que usaras para entrar al sistema.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" />
                                <p className="text-sm font-semibold text-stone-800">Sesión segura</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Tu acceso queda listo para iniciar sesión después de confirmar.
                                </p>
                            </div>
                        </div>
                    </section>

                    <Card className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.16)]">
                        <CardHeader className="flex flex-col items-start gap-2 border-b border-stone-100 px-8 pb-5 pt-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                                <BadgeCheck className="h-4 w-4" />
                                Confirmar cuenta
                            </div>
                            <h2 className="text-2xl font-semibold text-stone-900">
                                Crea tu contraseña
                            </h2>
                            <p className="text-sm leading-6 text-stone-500">
                                Usa el enlace del correo para terminar la activación.
                            </p>
                        </CardHeader>

                        <CardBody className="px-8 py-8">
                            {!token ? (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                    El enlace de activación no es válido. Solicita uno nuevo al administrador.
                                </div>
                            ) : (
                                <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                                    <div>
                                        <PasswordField
                                            label="Nueva contraseña"
                                            variant="bordered"
                                            radius="lg"
                                            size="lg"
                                            {...register("password", {
                                                required: "La contraseña es obligatoria",
                                                minLength: {
                                                    value: 8,
                                                    message: "La contraseña debe tener al menos 8 caracteres",
                                                },
                                            })}
                                        />
                                        {errors.password && (
                                            <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                                        )}
                                    </div>

                                    <div>
                                        <PasswordField
                                            label="Confirmar contraseña"
                                            variant="bordered"
                                            radius="lg"
                                            size="lg"
                                            {...register("confirmPassword", {
                                                required: "Debes confirmar la contraseña",
                                                validate: (value) =>
                                                    value === password || "Las contraseñas no coinciden",
                                            })}
                                        />
                                        {errors.confirmPassword && (
                                            <p className="mt-1 text-sm text-red-500">
                                                {errors.confirmPassword.message}
                                            </p>
                                        )}
                                    </div>

                                    {confirmMutation.isError && (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {confirmMutation.error.message}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        isLoading={confirmMutation.isPending}
                                        className="h-14 w-full rounded-full bg-[linear-gradient(135deg,#ca8a04_0%,#ea580c_100%)] text-base font-semibold text-white shadow-[0_18px_34px_rgba(202,138,4,0.32)]"
                                    >
                                        Activar mi cuenta
                                    </Button>
                                </form>
                            )}

                            <p className="mt-6 text-center text-sm text-stone-500">
                                <Link className="font-semibold text-orange-700 hover:text-orange-800" to={PATHS.login}>
                                    Volver al inicio de sesión
                                </Link>
                            </p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    )
}
