import { Button, Card, CardBody, CardHeader } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { resetPassword } from "@/api/AuthAPI"
import PasswordField from "@/components/auth/PasswordField"
import PATHS from "@/utils/constants/routes"

type NewPasswordFormData = {
    password: string
    confirmPassword: string
}

const initialValues: NewPasswordFormData = {
    password: "",
    confirmPassword: "",
}

export default function NewPassword() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token") ?? ""
    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<NewPasswordFormData>({
        defaultValues: initialValues,
    })

    const password = watch("password")
    const resetMutation = useMutation({
        mutationFn: resetPassword,
    })

    const onSubmit = async (formData: NewPasswordFormData) => {
        const message = await resetMutation.mutateAsync({
            token,
            password: formData.password,
        })

        navigate(PATHS.login, {
            replace: true,
            state: {
                notice: message,
            },
        })
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
                            Nueva contraseña
                        </p>
                        <h1 className="max-w-xl font-serif text-4xl leading-tight text-stone-900 md:text-5xl">
                            Crea una nueva clave de acceso
                        </h1>
                        <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 md:text-lg">
                            Este enlace te permite definir una nueva contraseña y volver a entrar al sistema.
                        </p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <KeyRound className="mb-3 h-5 w-5 text-amber-700" />
                                <p className="text-sm font-semibold text-stone-800">Token temporal</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    El enlace del correo valida que el cambio sea auténtico.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <LockKeyhole className="mb-3 h-5 w-5 text-orange-700" />
                                <p className="text-sm font-semibold text-stone-800">Clave renovada</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Define una contraseña nueva con al menos 8 caracteres.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" />
                                <p className="text-sm font-semibold text-stone-800">Ingreso protegido</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Al guardar, tu acceso anterior deja de ser el vigente.
                                </p>
                            </div>
                        </div>
                    </section>

                    <Card className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.16)]">
                        <CardHeader className="flex flex-col items-start gap-2 border-b border-stone-100 px-8 pb-5 pt-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                                <ShieldCheck className="h-4 w-4" />
                                Restablecer acceso
                            </div>
                            <h2 className="text-2xl font-semibold text-stone-900">
                                Actualiza tu contraseña
                            </h2>
                            <p className="text-sm leading-6 text-stone-500">
                                Completa estos datos para guardar tu nueva contraseña.
                            </p>
                        </CardHeader>

                        <CardBody className="px-8 py-8">
                            {!token ? (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                        El enlace de recuperación no es válido o está incompleto.
                                    </div>
                                    <Link
                                        to={PATHS.forgotPassword}
                                        className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#9a3412_0%,#ea580c_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(154,52,18,0.28)]"
                                    >
                                        Solicitar otro correo de recuperación
                                    </Link>
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

                                    {resetMutation.isError && (
                                        <div className="space-y-4">
                                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {resetMutation.error.message}
                                            </div>
                                            <Link
                                                to={PATHS.forgotPassword}
                                                className="inline-flex w-full items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                                            >
                                                Enviar otro correo con instrucciones
                                            </Link>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        isLoading={resetMutation.isPending}
                                        className="h-14 w-full rounded-full bg-[linear-gradient(135deg,#ca8a04_0%,#ea580c_100%)] text-base font-semibold text-white shadow-[0_18px_34px_rgba(202,138,4,0.32)]"
                                    >
                                        Guardar nueva contraseña
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
