export type FieldType = "text" | "number" | "email" | "checkbox" | "radio" | "select" | "textarea";

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { label: string; value: string }[];
  required: boolean;
}

