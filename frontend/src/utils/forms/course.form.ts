import { type FormField } from "@/types/form";

export const courseForm: FormField[] = [
    {
        name: "courseName",
        label: "Nombre del Curso",
        type: "text",
        required: true,
    },
    {
    name: "description",
    label: "Descripción",
    type: "textarea",
    required: true,
  },
  {
    name: "level",
    label: "Nivel",
    type: "select",
    options: [
      { label: "Básico", value: "basic" },
      { label: "Intermedio", value: "intermediate" },
      { label: "Avanzado", value: "advanced" },
    ],
    required: true,
  }
];