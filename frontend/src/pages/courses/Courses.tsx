import { useState } from "react";
import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import AssignCourseForm from "@/components/dashboard/AssignCourseForm";
import { type CourseFormData } from "@/types/index";
import { useForm } from "react-hook-form";
import { createCourse, getAllCourses } from "@/api/CourseAPI";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Pencil, Trash2, BadgePlus, NotebookPen } from "lucide-react";
import { Button } from "@heroui/react";
import { type CourseAssignedFormData } from '@/types/index';


export default function Courses() {
  const initialValues: CourseFormData = {
    name: "",
    description: "",
    level: "basic",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm({ defaultValues: initialValues });
  const assignForm = useForm<CourseAssignedFormData>({
  defaultValues: {
    course: "",
    professor: "",
    startDate: new Date(),
    startTime: "",
    totalClasses: 0,
    endDate: undefined,
    location: "",
    status: "active"
  }
});
  const [open, setOpen] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setOpen(false);
    reset(initialValues);
    setOpenAssign(false);
    assignForm.reset({ course: "", professor: "", startDate: new Date(), startTime: "", totalClasses: 0, endDate: undefined, location: "", status: "active" });
  };

  const mutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (data) => {
      toast.success(data ?? "Curso creado");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (formData: CourseFormData) => {
    try {
      await mutation.mutateAsync(formData);
      handleClose();
    } catch {
      // errors are handled by mutation onError
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: getAllCourses,
  });

  if (isLoading) return <h1>Cargando cursos...</h1>;

  return (
    <div className="p-4">
      <div className="flex justify-end gap-4">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4 flex items-center"
          onPress={() => setOpen(true)}
        >
          <BadgePlus className="size-5" />
          Crear curso
        </Button>

        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4 flex items-center"
          onPress={() => setOpenAssign(true)}
        >
          <NotebookPen className="size-5" />
          Asignar curso
        </Button>
      </div>

      <ModalView isOpen={open} onClose={handleClose} title="Crear curso">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CourseForm register={register} errors={errors} control={control} />

          <input
            type="submit"
            value="Crear Curso"
            className="text-white my-6 w-full uppercase font-bold bg-blue-600 hover:bg-blue-700 cursor-pointer rounded-lg text-sm px-5 py-2.5 text-center"
          />
        </form>
      </ModalView>

      <ModalView isOpen={openAssign} onClose={handleClose} title="Asignar curso">
        <form onSubmit={assignForm.handleSubmit(() => {/* lógica de asignación aquí */ })} noValidate>
          <AssignCourseForm
            control={assignForm.control}
            errors={assignForm.formState.errors}
          />        </form>
      </ModalView>

      <h2 className="text-2xl font-bold mb-4">{data?.length ? `Cursos Disponibles (${data.length})` : "No hay cursos disponibles"}</h2>

      <div>
        {data?.length ? (
          <ul className="flex gap-4 divide-gray-200">
            {data.map((course) => (
              <li key={course._id} className="flex flex-col justify-around p-4 h-44 w-5/12 border rounded shadow">
                <div className="flex-col space-y-2">
                  <div className="flex gap-4 items-center">
                    <h3 className="font-bold text-lg">{course.name}</h3>
                    <span className={`${course.level === "basic" ? "bg-green-400" : course.level === "intermediate" ? "bg-yellow-400" : "bg-red-400"} text-${course.level === "basic" ? "text-green-800" : course.level === "intermediate" ? "text-yellow-800" : "text-red-800"} text-xs font-medium px-2.5 py-0.5 rounded`}>
                      {course.level === "basic"
                        ? "Básico"
                        : course.level === "intermediate"
                          ? "Intermedio"
                          : course.level === "advanced"
                            ? "Avanzado"
                            : course.level}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm flex items-center">
                    {course.description.length > 100
                      ? course.description.slice(0, 100) + "..."
                      : course.description}
                  </p>
                </div>


                <div className="flex justify-center mt-4 items-center gap-4">
                  <Button className="w-full" color="primary">
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <Button className="w-full" color="danger">
                    <Trash2 className="size-4" />
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay cursos disponibles.</p>
        )}
      </div>
    </div>
  );
}
