import { useState } from "react";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import AssignCourseForm from "@/components/dashboard/AssignCourseForm";
import { useAuth } from "@/lib/auth";
import { type CourseFormData } from "@/types/index";
import { useForm } from "react-hook-form";
import {
  assignCourse,
  createCourse,
  deleteCourseAssignment,
  deleteCourse,
  getAllCourses,
  getCourseAssignments,
  updateCourseAssignment,
  updateCourse,
} from "@/api/CourseAPI";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { CalendarDays, MapPin, NotebookPen, Pencil, Trash2, UserRound, BadgePlus, Timer, BookOpenCheck } from "lucide-react";
import { Button } from "@heroui/react";
import { type CourseAssignedFormData, type Course, type CourseAssigned } from "@/types/index";
import {
  COURSE_LEVEL_BADGE_STYLES,
  COURSE_LEVEL_LABELS,
  COURSE_STATUS_LABELS,
} from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import { formatFullName } from "@/utils/text";

export default function Courses() {
  const { user } = useAuth();
  const isSuperadmin = user?.roles.includes("Superadmin") ?? false;
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
  } = useForm<CourseFormData>({ defaultValues: initialValues });

  const assignForm = useForm<CourseAssignedFormData>({
    defaultValues: initialAssignmentValues,
  });

  const [open, setOpen] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<CourseAssigned | null>(null);
  const queryClient = useQueryClient();

  const handleClose = () => {
    setOpen(false);
    setEditingCourse(null);
    reset(initialValues);
    setOpenAssign(false);
    setEditingAssignment(null);
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

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, formData }: { assignmentId: string; formData: CourseAssignedFormData }) =>
      updateCourseAssignment(assignmentId, formData),
    onSuccess: (message) => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["courseAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["myCourses"] });
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => deleteCourseAssignment(assignmentId),
    onSuccess: (message) => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["courseAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["myCourses"] });
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

  const handleEditAssignment = (assignment: CourseAssigned) => {
    setEditingAssignment(assignment);
    assignForm.reset({
      course: assignment.course._id,
      professor: assignment.professor._id,
      startDate: assignment.startDate.split("T")[0] ?? assignment.startDate,
      startTime: assignment.startTime,
      totalClasses: assignment.totalClasses,
      endDate: assignment.endDate.split("T")[0] ?? assignment.endDate,
      location: assignment.location,
      status: assignment.status,
    });
    setOpenAssign(true);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    showSweetAlert({
      title: "Eliminar asignacion?",
      text: "Se eliminara el curso asignado y sus registros asociados.",
      type: "warning",
      confirmButtonText: "Si, eliminar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      onConfirm: async () => {
        try {
          await deleteAssignmentMutation.mutateAsync(assignmentId);
        } catch {
          // errors are handled by mutation onError
        }
      },
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId),
    onSuccess: (message) => {
      toast.success(message);
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

  const { data: courses = [], isLoading, isError: isCoursesError, error: coursesError } = useQuery({
    queryKey: ["courses"],
    queryFn: getAllCourses,
  });

  const {
    data: assignments = [],
    isError: isAssignmentsError,
    error: assignmentsError
  } = useQuery({
    queryKey: ["courseAssignments"],
    queryFn: getCourseAssignments,
  });

  console.log(assignments);


  if (isLoading) return <h1>Cargando cursos...</h1>;
  if (isCoursesError) return <h1>{coursesError.message}</h1>;
  if (isAssignmentsError) return <h1>{assignmentsError.message}</h1>;

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
          onPress={() => {
            setEditingAssignment(null);
            assignForm.reset(initialAssignmentValues);
            setOpenAssign(true);
          }}
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

      <ModalView
        isOpen={openAssign}
        onClose={handleClose}
        title={editingAssignment ? "Editar curso asignado" : "Asignar curso"}
      >
        <form
          onSubmit={assignForm.handleSubmit(async (formData) => {
            try {
              if (editingAssignment) {
                await updateAssignmentMutation.mutateAsync({
                  assignmentId: editingAssignment._id,
                  formData,
                });
              } else {
                await assignMutation.mutateAsync(formData);
              }
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
            currentAssignmentId={editingAssignment?._id ?? null}
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
                    <span className={`${COURSE_LEVEL_BADGE_STYLES[course.level]} rounded px-2.5 py-0.5 text-xs font-medium`}>
                      {COURSE_LEVEL_LABELS[course.level]}
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
                <div className="flex items-start gap-2">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase text-green-700">
                    {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                  </span>
                  {isSuperadmin ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        isIconOnly
                        color="primary"
                        variant="flat"
                        aria-label={`Editar asignacion de ${assignment.course.name}`}
                        onPress={() => handleEditAssignment(assignment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        variant="flat"
                        aria-label={`Eliminar asignacion de ${assignment.course.name}`}
                        onPress={() => handleDeleteAssignment(assignment._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
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
                <p className="text-sm text-gray-600">
                  Miembros registrados: {assignment.members.length}
                </p>
              </div>

              {false && isSuperadmin ? (
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    color="primary"
                    className="w-full"
                    onPress={() => handleEditAssignment(assignment)}
                  >
                    <Pencil className="size-4" />
                    Editar asignación
                  </Button>
                  <Button
                    color="danger"
                    className="w-full"
                    onPress={() => handleDeleteAssignment(assignment._id)}
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>

      ) : null}
    </div>
  );
}
