import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, Mail, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { forgotPassword } from "@/api/AuthAPI"
import PATHS from "@/utils/constants/routes"

type ForgotPasswordFormData = {
    email: string
}

export default function ForgotPassword() {
    const navigate = useNavigate()
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormData>({
        defaultValues: {
            email: "",
        },
    })

    const forgotMutation = useMutation({
        mutationFn: forgotPassword,
    })

    const onSubmit = async (formData: ForgotPasswordFormData) => {
        const message = await forgotMutation.mutateAsync({
            email: formData.email.trim().toLowerCase(),
        })

        navigate(PATHS.login, {
            replace: true,
            state: {
                notice: message,
            },
        })
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(180,83,9,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.14),_transparent_28%),linear-gradient(180deg,_#fffaf2_0%,_#f2eadb_50%,_#eadbc4_100%)] px-4 py-10">
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

                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-orange-700">
                            Recuperación de acceso
                        </p>
                        <h1 className="max-w-xl font-serif text-4xl leading-tight text-stone-900 md:text-5xl">
                            Restablece tu contraseña
                        </h1>
                        <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 md:text-lg">
                            Ingresa tu correo y te enviaremos un enlace firmado para crear una nueva contraseña.
                        </p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <Mail className="mb-3 h-5 w-5 text-orange-700" />
                                <p className="text-sm font-semibold text-stone-800">Correo validado</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Usamos el correo asociado a tu acceso al sistema.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <KeyRound className="mb-3 h-5 w-5 text-cyan-700" />
                                <p className="text-sm font-semibold text-stone-800">Enlace temporal</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    El enlace tiene vencimiento automático para mayor seguridad.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" />
                                <p className="text-sm font-semibold text-stone-800">Cambio seguro</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Tu nueva contraseña se guarda cifrada antes de iniciar sesión.
                                </p>
                            </div>
                        </div>
                    </section>

                    <Card className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.16)]">
                        <CardHeader className="flex flex-col items-start gap-2 border-b border-stone-100 px-8 pb-5 pt-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                                <Mail className="h-4 w-4" />
                                Recuperar acceso
                            </div>
                            <h2 className="text-2xl font-semibold text-stone-900">
                                Te enviamos un enlace seguro
                            </h2>
                            <p className="text-sm leading-6 text-stone-500">
                                Si el correo existe, recibirás instrucciones de recuperación.
                            </p>
                        </CardHeader>

                        <CardBody className="px-8 py-8">
                            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                                <div>
                                    <Input
                                        label="Correo electrónico"
                                        type="email"
                                        variant="bordered"
                                        radius="lg"
                                        size="lg"
                                        {...register("email", {
                                            required: "El correo es obligatorio",
                                            pattern: {
                                                value: /\S+@\S+\.\S+/,
                                                message: "Ingresa un correo válido",
                                            },
                                        })}
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                                    )}
                                </div>

                                {forgotMutation.isSuccess && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        {forgotMutation.data}
                                    </div>
                                )}

                                {forgotMutation.isError && (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {forgotMutation.error.message}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    isLoading={forgotMutation.isPending}
                                    className="h-14 w-full rounded-full bg-[linear-gradient(135deg,#9a3412_0%,#ea580c_100%)] text-base font-semibold text-white shadow-[0_18px_34px_rgba(154,52,18,0.28)]"
                                >
                                    Enviar enlace de recuperación
                                </Button>
                            </form>

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
