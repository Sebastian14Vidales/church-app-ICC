import { useState } from "react";
import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import { type CourseFormData } from '@/types/index';
import { useForm } from "react-hook-form";
import { createCourse } from "@/api/CourseAPI";
// import { useNavigate } from "react-router-dom";
import { toast }from "react-toastify";

export default function Courses() {
  // const navigate = useNavigate();

  const initialValues: CourseFormData = {
    name: "",
    description: "",
    level: "basic"
  }
const { register, handleSubmit, formState: { errors }, reset, control } = useForm({ defaultValues: initialValues });  
const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    reset(initialValues);
  };

  const onSubmit = async (formData: CourseFormData) => {
    const data = await createCourse(formData);
    console.log(data);
    toast.success("Curso creado exitosamente");
    handleClose();
  }

  return (
    <div className="p-4">
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4"
        onClick={() => setOpen(true)}
      >
        Crear curso
      </button>

      <ModalView
        isOpen={open}
        onClose={handleClose}
        title="Crear curso"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CourseForm register={register} errors={errors} control={control} />

          <input
            type="submit"
            value="Crear Curso"
            className="text-white my-6 w-full uppercase font-bold bg-blue-600 hover:bg-blue-700 cursor-pointer rounded-lg text-sm px-5 py-2.5 text-center"
          />
        </form>

      </ModalView>

      <div>Courses</div>
    </div>
  );
}
