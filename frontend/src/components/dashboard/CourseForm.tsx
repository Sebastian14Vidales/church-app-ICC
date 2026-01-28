import DynamicForm from "@/components/forms/DynamicForm";
import { courseForm } from "@/utils/forms/course.form";

export default function CourseForm() {
  const handleSubmit = (data: Record<string, any>) => {
    console.log("Curso:", data);

    // aquí llamas a tu backend
    // POST /courses
  };

  return (
    <DynamicForm
      formId="create-course-form"
      fields={courseForm}
      onSubmit={handleSubmit}
    />
  );
}
