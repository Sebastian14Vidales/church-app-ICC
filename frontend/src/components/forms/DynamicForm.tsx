import { type FormField } from "@/types/form";
import { Input, Select, SelectItem, Textarea } from "@heroui/react";

interface Props {
    fields: FormField[];
    onSubmit: (data: Record<string, any>) => void;
    formId: string;
}

export default function DynamicForm({ fields, onSubmit, formId }: Props) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        onSubmit(data);
    };

    return (
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
                <div key={field.name} className="flex flex-col space-y-4">
                    <label className="block text-sm font-medium text-gray-700">{field.label}</label>

                    {field.type === "textarea" ? (
                        <Textarea
                            name={field.name}
                            className="input"
                            placeholder={field.placeholder}
                            required={field.required}
                            classNames={{
                                inputWrapper: "border-none shadow-none",
                                input: "focus:outline-none focus:ring-0",
                            }}
                        />
                    ) : field.type === "select" ? (
                        <Select name={field.name} required={field.required} className="input" placeholder="Seleccione un nivel">
                            {(field.options ?? []).map((opt) => (
                                <SelectItem key={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </Select>
                    ) : (
                        <Input
                            name={field.name}
                            type={field.type}
                            placeholder={field.placeholder}
                            required={field.required}
                            className="input"
                            classNames={{
                                inputWrapper: "border-none shadow-none",
                                input: "focus:outline-none focus:ring-0",
                            }}
                        />
                    )}
                </div>
            ))}
        </form>
    );
}
