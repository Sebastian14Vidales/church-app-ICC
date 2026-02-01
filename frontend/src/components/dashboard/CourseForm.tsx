import {type UseFormRegister, type FieldErrors } from "react-hook-form";
import {type CourseFormData} from '@/types/index';
import { Input, Select, SelectItem, Textarea } from "@heroui/react";


export type CourseFormProps = {
    register: UseFormRegister<CourseFormData>;
    errors: FieldErrors<CourseFormData>;
}

export default function CourseForm({ register, errors }: CourseFormProps) {
  return (
    <div className="flex flex-col space-y-4">
      <div>
        <label htmlFor="courseName" className="block text-sm font-medium text-gray-700">Nombre del curso</label>
        <Input
          id="courseName"
          {...register("courseName", { required: true })}
          type="text"
          placeholder="Ingrese el nombre del curso"
          className="input"
          classNames={{
            inputWrapper: "border-none shadow-none",
            input: "focus:outline-none focus:ring-0",
          }}
        />
        {errors.courseName && (
          <span className="text-red-500 text-xs">Este campo es requerido</span>
        )}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
        <Textarea
          id="description"
          {...register("description", { required: true })}
          className="input"
          placeholder="Ingrese la descripción del curso"
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
        <label htmlFor="level" className="block text-sm font-medium text-gray-700">Nivel</label>
        <Select
          id="level"
          {...register("level", { required: true })}
          className="input"
          placeholder="Seleccione un nivel"
        >
          <SelectItem>Básico</SelectItem>
          <SelectItem>Intermedio</SelectItem>
          <SelectItem>Avanzado</SelectItem>
        </Select>
        {errors.level && (
          <span className="text-red-500 text-xs">Este campo es requerido</span>
        )}
      </div>
    </div>
  );
}
