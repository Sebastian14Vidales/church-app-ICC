import { type UseFormRegister, type FieldErrors, type Control } from "react-hook-form";
import { spiritualGrowthStageSchema, type CourseFormData } from '@/types/index';
import { Input, SelectItem, Textarea } from "@heroui/react";
import FormSelect from "@/components/common/FormSelect";
import { COURSE_LEVEL_OPTIONS } from "@/utils/constants/courses";

const SPIRITUAL_GROWTH_STAGES = spiritualGrowthStageSchema.options;


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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nivel
          </label>

          <FormSelect
            name="level"
            control={control}
            rules={{ required: true }}
            placeholder="Seleccione un nivel"
            className="input"
          >
            {COURSE_LEVEL_OPTIONS.map((level) => (
              <SelectItem key={level.value}>{level.label}</SelectItem>
            ))}
          </FormSelect>

          {errors.level && (
            <span className="text-red-500 text-xs">
              Este campo es requerido
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Etapa de crecimiento espiritual
          </label>

          <FormSelect
            name="spiritualGrowthStage"
            control={control}
            rules={{ required: true }}
            placeholder="Seleccione una etapa"
            className="input"
          >
            {SPIRITUAL_GROWTH_STAGES.map((stage) => (
              <SelectItem key={stage}>{stage}</SelectItem>
            ))}
          </FormSelect>

          {errors.spiritualGrowthStage && (
            <span className="text-red-500 text-xs">
              Este campo es requerido
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


