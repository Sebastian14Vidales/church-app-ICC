import { type UseFormRegister, type FieldErrors, Controller, type Control } from "react-hook-form";
import { type CourseFormData } from '@/types/index';
import { Input, Select, SelectItem, Textarea } from "@heroui/react";


export type CourseFormProps = {
  register: UseFormRegister<CourseFormData>;
  errors: FieldErrors<CourseFormData>;
  control: Control<CourseFormData>;
}

export default function CourseForm({ register, errors, control }: CourseFormProps) {
  return (
    <div className="flex flex-col space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre del curso</label>
        <Input
          id="name"
          {...register("name", { required: true })}
          type="text"
          placeholder="Ingrese el nombre del curso"
          className="input"
          classNames={{
            inputWrapper: "border-none shadow-none",
            input: "focus:outline-none focus:ring-0",
          }}
        />
        {errors.name && (
          <span className="text-red-500 text-xs">Este campo es requerido</span>
        )}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
        <Textarea
          id="description"
          {...register("description", { required: true })}
          className="input"
          placeholder="Ingrese la Descripción del curso"
          classNames={{
            inputWrapper: "border-none shadow-none",
            input: "focus:outline-none focus:ring-0",
          }}
        />
        {errors.description && (
          <span className="text-red-500 text-xs">Este campo es requerido</span>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nivel
        </label>

        <Controller
          name="level"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Select
              selectedKeys={field.value ? [field.value] : []}
              onSelectionChange={(keys) => {
                field.onChange([...keys][0] ?? "");
              }}
              placeholder="Seleccione un nivel"
              className="input"
            >
              <SelectItem key="basic">Básico</SelectItem>
              <SelectItem key="intermediate">Intermedio</SelectItem>
              <SelectItem key="advanced">Avanzado</SelectItem>
            </Select>
          )}
        />

        {errors.level && (
          <span className="text-red-500 text-xs">
            Este campo es requerido
          </span>
        )}
      </div>
    </div>
  );
}


