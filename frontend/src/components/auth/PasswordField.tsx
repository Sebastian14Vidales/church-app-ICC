import { useState } from "react"
import { Input, type InputProps } from "@heroui/react"
import { Eye, EyeOff } from "lucide-react"

type PasswordFieldProps = Omit<InputProps, "type"> & {
    visibilityLabel?: string
}

export default function PasswordField({
    visibilityLabel = "Mostrar u ocultar contrasena",
    endContent,
    ...props
}: PasswordFieldProps) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <Input
            {...props}
            type={isVisible ? "text" : "password"}
            endContent={
                endContent ?? (
                    <button
                        type="button"
                        aria-label={visibilityLabel}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => setIsVisible((current) => !current)}
                    >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )
            }
        />
    )
}
