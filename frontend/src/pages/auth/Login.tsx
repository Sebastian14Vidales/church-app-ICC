import { useEffect, useMemo } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { LockKeyhole, LogIn, MailCheck, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "@/api/AuthAPI";
import PATHS from "@/utils/constants/routes";

type LoginFormData = {
    email: string
    password: string
}

const initialValues: LoginFormData = {
    email: "",
    password: "",
}

export default function Login() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const initialEmail = useMemo(() => searchParams.get("email") ?? "", [searchParams])
    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<LoginFormData>({
        defaultValues: {
            ...initialValues,
            email: initialEmail,
        },
    })

    useEffect(() => {
        if (initialEmail) {
            setValue("email", initialEmail, { shouldDirty: false })
            navigate(PATHS.login, { replace: true })
        }
    }, [initialEmail, navigate, setValue])

    const loginMutation = useMutation({
        mutationFn: login,
    })

    const onSubmit = async (formData: LoginFormData) => {
        const response = await loginMutation.mutateAsync({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
        })

        sessionStorage.setItem("authUser", JSON.stringify(response.user))
        navigate(PATHS.dashboard, { replace: true })
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
                            Inicio de sesion
                        </p>
                        <h1 className="max-w-xl font-serif text-4xl leading-tight text-stone-900 md:text-5xl">
                            Iglesia Casa de Dios - Cruzada Cristiana
                        </h1>
                        <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 md:text-lg">
                            Accede a la plataforma con tu correo y contrasena para administrar
                            miembros, cursos y procesos internos de la iglesia.
                        </p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <MailCheck className="mb-3 h-5 w-5 text-orange-700" />
                                <p className="text-sm font-semibold text-stone-800">Correo validado</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Usa el correo con el que activaste tu cuenta.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <LockKeyhole className="mb-3 h-5 w-5 text-cyan-700" />
                                <p className="text-sm font-semibold text-stone-800">Acceso seguro</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Tu contrasena se valida de forma cifrada.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                                <Shield className="mb-3 h-5 w-5 text-emerald-700" />
                                <p className="text-sm font-semibold text-stone-800">Ingreso rapido</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Al iniciar sesion te llevamos al panel principal.
                                </p>
                            </div>
                        </div>
                    </section>

                    <Card className="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(120,53,15,0.16)]">
                        <CardHeader className="flex flex-col items-start gap-2 border-b border-stone-100 px-8 pb-5 pt-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                                <LogIn className="h-4 w-4" />
                                Accede a tu cuenta
                            </div>
                            <h2 className="text-2xl font-semibold text-stone-900">
                                Bienvenido de nuevo
                            </h2>
                            <p className="text-sm leading-6 text-stone-500">
                                Ingresa tus credenciales para entrar al sistema.
                            </p>
                        </CardHeader>

                        <CardBody className="px-8 py-8">
                            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                                <div>
                                    <Input
                                        label="Correo electronico"
                                        type="email"
                                        variant="bordered"
                                        radius="lg"
                                        size="lg"
                                        {...register("email", {
                                            required: "El correo es obligatorio",
                                            pattern: {
                                                value: /\S+@\S+\.\S+/,
                                                message: "Ingresa un correo valido",
                                            },
                                        })}
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Input
                                        label="Contrasena"
                                        type="password"
                                        variant="bordered"
                                        radius="lg"
                                        size="lg"
                                        {...register("password", {
                                            required: "La contrasena es obligatoria",
                                        })}
                                    />
                                    {errors.password && (
                                        <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                                    )}
                                </div>

                                {loginMutation.isError && (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {loginMutation.error.message}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    isLoading={loginMutation.isPending}
                                    className="h-14 w-full rounded-full bg-[linear-gradient(135deg,#9a3412_0%,#ea580c_100%)] text-base font-semibold text-white shadow-[0_18px_34px_rgba(154,52,18,0.28)]"
                                >
                                    Iniciar sesion
                                </Button>
                            </form>

                            <p className="mt-6 text-center text-sm text-stone-500">
                                ¿Necesitas activar tu cuenta primero?{" "}
                                <Link className="font-semibold text-orange-700 hover:text-orange-800" to={PATHS.confirmAccount}>
                                    Ir a validacion
                                </Link>
                            </p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    )
}
