import { Controller, type FieldErrors, type Control } from "react-hook-form";
import { Button, Select, SelectItem } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getAllCourses } from "@/api/CourseAPI";
import { type CourseAssignedFormData } from "@/types/index";

export type AssignCourseFormProps = {
    control: Control<CourseAssignedFormData>;
    errors: FieldErrors<CourseAssignedFormData>;
}

export default function AssignCourseForm({ control, errors }: AssignCourseFormProps) {
    const { data = [] } = useQuery({
        queryKey: ["courses"],
        queryFn: getAllCourses
    });

    return (
        <div className="space-y-4">

            <div>
                <label className="block text-sm font-medium mb-1">
                    Curso
                </label>

                <Controller
                    name="course"
                    control={control}
                    rules={{ required: "Curso requerido" }}
                    render={({ field }) => (
                        <Select
                            selectedKeys={field.value ? [field.value] : []}
                            onSelectionChange={(keys) =>
                                field.onChange(Array.from(keys)[0])
                            }
                            className="w-full"
                            placeholder="Selecciona un curso"
                        >
                            {data?.map((curso) => (
                                <SelectItem key={curso._id}>
                                    {curso.name}
                                </SelectItem>
                            ))}
                        </Select>
                    )}
                />

                {errors.course && (
                    <span className="text-red-500 text-xs">
                        {errors.course.message}
                    </span>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    Profesor
                </label>
                <Controller
                    name="professor"
                    control={control}
                    rules={{ required: "Profesor requerido" }}
                    render={({ field }) => (
                        <input
                            {...field}
                            className="w-full border rounded px-3 py-2"
                            placeholder="ID del profesor"
                        />
                    )}
                />
                {errors.professor && (
                    <span className="text-red-500 text-xs">
                        {errors.professor.message}
                    </span>
                )}
            </div>

            <Button type="submit" color="primary" className="w-full">
                Asignar Curso
            </Button>
        </div>
    );
}