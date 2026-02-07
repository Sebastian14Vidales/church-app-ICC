import { useState } from "react";
import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import { type CourseFormData } from "@/types/index";
import { useForm } from "react-hook-form";
import { createCourse, getAllCourses } from "@/api/CourseAPI";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@heroui/react";

export default function Courses() {
  const initialValues: CourseFormData = {
    name: "",
    description: "",
    level: "",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm({ defaultValues: initialValues });
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setOpen(false);
    reset(initialValues);
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
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4"
        onClick={() => setOpen(true)}
      >
        Crear curso
      </button>

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

      <div>
        {data?.length ? (
          <ul className="space-y-4 divide-y divide-gray-200">
            {data.map((course) => (
              <li key={course._id} className="flex justify-between p-4 border rounded shadow">
                <div className="flex-col space-y-2">
                  <h3 className="font-bold text-lg">{course.name}</h3>
                  <p className="text-gray-600">{course.description}</p>
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
                <div className="flex flex-col items-center gap-4">
                  <Button className="w-28" color="primary">
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <Button className="w-28" color="danger">
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
