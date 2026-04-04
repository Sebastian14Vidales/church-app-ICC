import { useEffect } from "react";
import { Controller, useWatch, type Control, type FieldErrors, type UseFormSetValue } from "react-hook-form";
import { Button, DatePicker, Select, SelectItem } from "@heroui/react";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import { useQuery } from "@tanstack/react-query";
import { getAllCourses, getCourseAssignments } from "@/api/CourseAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { type CourseAssignedFormData } from "@/types/index";
import { LOCATIONS } from "@/utils/constants/locations";
import { formatFullName } from "@/utils/text";

export type AssignCourseFormProps = {
    control: Control<CourseAssignedFormData>;
    errors: FieldErrors<CourseAssignedFormData>;
    setValue: UseFormSetValue<CourseAssignedFormData>;
    currentAssignmentId?: string | null;
};

const calculateEndDate = (startDate: string, totalClasses: number) => {
    if (!startDate || !totalClasses || totalClasses < 1) return "";

    const [year, month, day] = startDate.split("-").map(Number);
    const calculatedDate = new Date(year, month - 1, day);
    calculatedDate.setDate(calculatedDate.getDate() + (totalClasses - 1) * 7);

    const calculatedYear = calculatedDate.getFullYear();
    const calculatedMonth = `${calculatedDate.getMonth() + 1}`.padStart(2, "0");
    const calculatedDay = `${calculatedDate.getDate()}`.padStart(2, "0");

    return `${calculatedYear}-${calculatedMonth}-${calculatedDay}`;
};

const formatDisplayDate = (value: string) => {
    if (!value) return "";
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

export default function AssignCourseForm({
    control,
    errors,
    setValue,
    currentAssignmentId = null,
}: AssignCourseFormProps) {
    const { data: courses = [] } = useQuery({
        queryKey: ["courses"],
        queryFn: getAllCourses,
    });

    const { data: members = [] } = useQuery({
        queryKey: ["members"],
        queryFn: getAllMembers,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ["courseAssignments"],
        queryFn: getCourseAssignments,
    });

    const assignedProfessorIds = new Set(
        assignments
            .filter((assignment) => assignment.status === "active" && assignment._id !== currentAssignmentId)
            .map((assignment) => assignment.professor._id),
    );

    const professors = members.filter(
        (member) => member.role.name === "Profesor" && !assignedProfessorIds.has(member._id),
    );
    const startDate = useWatch({ control, name: "startDate" });
    const totalClasses = useWatch({ control, name: "totalClasses" });
    const calculatedEndDate = calculateEndDate(startDate, totalClasses);

    useEffect(() => {
        setValue("endDate", calculatedEndDate);
    }, [calculatedEndDate, setValue]);

    return (
        <div className="space-y-4">
            <div>
                <label className="mb-1 block text-sm font-medium">Curso</label>

                <Controller
                    name="course"
                    control={control}
                    rules={{ required: "Curso requerido" }}
                    render={({ field }) => (
                        <Select
                            selectedKeys={field.value ? [field.value] : []}
                            onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                            className="w-full"
                            placeholder="Selecciona un curso"
                        >
                            {courses.map((course) => (
                                <SelectItem key={course._id}>{course.name}</SelectItem>
                            ))}
                        </Select>
                    )}
                />

                {errors.course && <span className="text-xs text-red-500">{errors.course.message}</span>}
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium">Profesor</label>

                <Controller
                    name="professor"
                    control={control}
                    rules={{ required: "Profesor requerido" }}
                    render={({ field }) => (
                        <Select
                            selectedKeys={field.value ? [field.value] : []}
                            onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                            className="w-full"
                            placeholder={professors.length ? "Selecciona un profesor" : "No hay profesores registrados"}
                            isDisabled={!professors.length}
                        >
                            {professors.map((professor) => (
                                <SelectItem key={professor._id}>
                                    {formatFullName(professor.firstName, professor.lastName)}
                                </SelectItem>
                            ))}
                        </Select>
                    )}
                />

                {errors.professor && <span className="text-xs text-red-500">{errors.professor.message}</span>}
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium">Fecha de inicio</label>
                <Controller
                    name="startDate"
                    control={control}
                    rules={{ required: "Fecha de inicio requerida" }}
                    render={({ field }) => (
                        <DatePicker
                            value={field.value ? parseDate(field.value) : null}
                            onChange={(value) => field.onChange(value ? value.toString() : "")}
                            minValue={today(getLocalTimeZone())}
                            className="w-full"
                        />
                    )}
                />
                {errors.startDate && <span className="text-xs text-red-500">{errors.startDate.message}</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium">Hora de inicio</label>
                    <Controller
                        name="startTime"
                        control={control}
                        rules={{ required: "Hora de inicio requerida" }}
                        render={({ field }) => (
                            <input
                                type="time"
                                {...field}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        )}
                    />
                    {errors.startTime && <span className="text-xs text-red-500">{errors.startTime.message}</span>}
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium">Numero de clases</label>
                    <Controller
                        name="totalClasses"
                        control={control}
                        rules={{ required: "Total de clases requerido", min: 1 }}
                        render={({ field }) => (
                            <input
                                type="number"
                                min={1}
                                value={field.value || ""}
                                onChange={(event) => field.onChange(Number(event.target.value))}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        )}
                    />
                    {errors.totalClasses && <span className="text-xs text-red-500">{errors.totalClasses.message}</span>}
                </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900">Fecha final calculada</p>
                <p className="text-sm text-blue-700">
                    {calculatedEndDate ? formatDisplayDate(calculatedEndDate) : "Selecciona una fecha de inicio y el numero de clases"}
                </p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium">Salon</label>

                <Controller
                    name="location"
                    control={control}
                    rules={{ required: "Salon requerido" }}
                    render={({ field }) => (
                        <Select
                            selectedKeys={field.value ? [field.value] : []}
                            onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                            className="w-full"
                            placeholder="Selecciona un salon"
                        >
                            {LOCATIONS.map((location) => (
                                <SelectItem key={location.id}>{location.name}</SelectItem>
                            ))}
                        </Select>
                    )}
                />

                {errors.location && <span className="text-xs text-red-500">{errors.location.message}</span>}
            </div>

            <Button type="submit" color="primary" className="w-full">
                Asignar curso
            </Button>
        </div>
    );
}
