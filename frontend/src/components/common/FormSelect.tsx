import {
  useController,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from "react-hook-form";
import { Select, type SelectProps, type Selection } from "@heroui/react";
import { useStableSelection } from "@/hooks/useStableSelection";

type FormSelectProps<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  label?: string;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  isDisabled?: boolean;
  selectionMode?: "single" | "multiple";
  children: SelectProps["children"];
};

export default function FormSelect<T extends FieldValues>({
  name,
  control,
  rules,
  label,
  placeholder,
  "aria-label": ariaLabel,
  className,
  isDisabled,
  selectionMode = "single",
  children,
}: FormSelectProps<T>) {
  const { field } = useController({
    name,
    control,
    rules,
  });

  const selectedKeys = useStableSelection(
    field.value as string | string[] | undefined | null,
  );

  const handleSelectionChange = (keys: Selection) => {
    const values = keys === "all" ? [] : Array.from(keys);

    if (selectionMode === "multiple") {
      field.onChange(values as string[]);
      return;
    }

    field.onChange((values[0] as string | undefined) ?? "");
  };

  return (
    <>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <Select
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
        isDisabled={isDisabled}
        selectionMode={selectionMode}
      >
        {children}
      </Select>
    </>
  );
}
