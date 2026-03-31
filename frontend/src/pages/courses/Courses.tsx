import { useState } from "react";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import AssignCourseForm from "@/components/dashboard/AssignCourseForm";
import { type CourseFormData } from "@/types/index";
import { useForm } from "react-hook-form";
import {
  assignCourse,
  createCourse,
  deleteCourse,
  getAllCourses,
  getCourseAssignments,
  updateCourse,
} from "@/api/CourseAPI";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { CalendarDays, MapPin, NotebookPen, Pencil, Trash2, UserRound, BadgePlus, Timer, BookOpenCheck } from "lucide-react";
import { Button } from "@heroui/react";
import { type CourseAssignedFormData, type Course } from "@/types/index";
import { getLocationNameById } from "@/utils/constants/locations";
import { formatFullName } from "@/utils/text";

const COURSE_STATUS_LABELS = {
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
} as const;

export default function Courses() {
  const initialValues: CourseFormData = {
    name: "",
    description: "",
    level: "basic",
  };

  const initialAssignmentValues: CourseAssignedFormData = {
    course: "",
    professor: "",
    startDate: "",
    startTime: "",
    totalClasses: 0,
    endDate: "",
    location: "",
    status: "active",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm({ defaultValues: initialValues });

  const assignForm = useForm<CourseAssignedFormData>({
    defaultValues: initialAssignmentValues,
  });

  const [open, setOpen] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setOpen(false);
    setEditingCourse(null);
    reset(initialValues);
    setOpenAssign(false);
    assignForm.reset(initialAssignmentValues);
  };

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (data) => {
      toast.success(data ?? "Curso creado");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ courseId, formData }: { courseId: string; formData: CourseFormData }) =>
      updateCourse(courseId, formData),
    onSuccess: (data) => {
      toast.success(data ?? "Curso actualizado");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: assignCourse,
    onSuccess: (message) => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["courseAssignments"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    reset({
      name: course.name,
      description: course.description,
      level: course.level,
    });
    setOpen(true);
  };

  const onSubmit = async (formData: CourseFormData) => {
    try {
      if (editingCourse) {
        await updateMutation.mutateAsync({ courseId: editingCourse._id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      handleClose();
    } catch {
      // errors are handled by mutation onError
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId),
    onSuccess: () => {
      toast.success("Curso eliminado");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDeleteCourse = async (courseId: string) => {
    showSweetAlert({
      title: "Eliminar curso?",
      text: "Esta accion no se puede deshacer.",
      type: "warning",
      confirmButtonText: "Si, eliminar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(courseId);
        } catch {
          // errors are handled by mutation onError
        }
      },
    });
  };

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: getAllCourses,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["courseAssignments"],
    queryFn: getCourseAssignments,
  });

  if (isLoading) return <h1>Cargando cursos...</h1>;

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-end gap-4">
        <Button
          className="mb-4 flex items-center rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          onPress={() => {
            setEditingCourse(null);
            reset(initialValues);
            setOpen(true);
          }}
        >
          <BadgePlus className="size-5" />
          Crear curso
        </Button>

        <Button
          className="mb-4 flex items-center rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          onPress={() => setOpenAssign(true)}
        >
          <NotebookPen className="size-5" />
          Asignar curso
        </Button>
      </div>

      <ModalView isOpen={open} onClose={handleClose} title={editingCourse ? "Editar curso" : "Crear curso"}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CourseForm register={register} errors={errors} control={control} />

          <input
            type="submit"
            value={editingCourse ? "Guardar Cambios" : "Crear Curso"}
            className="my-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-bold uppercase text-white hover:bg-blue-700"
          />
        </form>
      </ModalView>

      <ModalView isOpen={openAssign} onClose={handleClose} title="Asignar curso">
        <form
          onSubmit={assignForm.handleSubmit(async (formData) => {
            try {
              await assignMutation.mutateAsync(formData);
            } catch {
              // errors are handled by mutation onError
            }
          })}
          noValidate
        >
          <AssignCourseForm
            control={assignForm.control}
            errors={assignForm.formState.errors}
            setValue={assignForm.setValue}
          />
        </form>
      </ModalView>

      <h2 className="mb-4 text-2xl font-bold">
        {courses.length ? `Cursos Disponibles (${courses.length})` : "No hay cursos disponibles"}
      </h2>

      <div>
        {courses.length ? (
          <ul className="flex gap-4 divide-gray-200">
            {courses.map((course) => (
              <li key={course._id} className="flex h-44 w-5/12 flex-col justify-around rounded border p-4 shadow">
                <div className="flex-col space-y-2">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold">{course.name}</h3>
                    <span className={`${course.level === "basic" ? "bg-green-400" : course.level === "intermediate" ? "bg-yellow-400" : "bg-red-400"} text-${course.level === "basic" ? "text-green-800" : course.level === "intermediate" ? "text-yellow-800" : "text-red-800"} rounded px-2.5 py-0.5 text-xs font-medium`}>
                      {course.level === "basic"
                        ? "Basico"
                        : course.level === "intermediate"
                          ? "Intermedio"
                          : course.level === "advanced"
                            ? "Avanzado"
                            : course.level}
                    </span>
                  </div>
                  <p className="flex items-center text-sm text-gray-600">
                    {course.description.length > 100
                      ? `${course.description.slice(0, 100)}...`
                      : course.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                  <Button className="w-full" color="primary" onPress={() => handleEditCourse(course)}>
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <Button className="w-full" color="danger" onPress={() => handleDeleteCourse(course._id)}>
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

      <h2 className="mb-4 mt-10 text-2xl font-bold">
        {assignments.length ? `Cursos Asignados (${assignments.length})` : "No hay cursos asignados"}
      </h2>

      {assignments.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => (
            <article key={assignment._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{assignment.course.name}</h3>
                  <p className="text-sm text-gray-500">{assignment.course.description}</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase text-green-700">
                  {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-gray-400" />
                  {formatFullName(assignment.professor.firstName, assignment.professor.lastName)}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  Inicio: {new Date(assignment.startDate).toLocaleDateString("es-ES")} - Fin: {new Date(assignment.endDate).toLocaleDateString("es-ES")}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {getLocationNameById(assignment.location)}
                </p>
                <p className="flex items-center gap-2 ">
                  <Timer className="h-4 w-4 text-gray-400" />
                  Hora: {assignment.startTime}
                </p>
                <p className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-gray-400" />
                  Total de clases: {assignment.totalClasses}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
