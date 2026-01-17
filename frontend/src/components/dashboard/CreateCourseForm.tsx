import { Input, Textarea } from "@heroui/react";

export default function CreateCourseForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Nombre del Curso<small className="text-sm text-red-500">*</small></label>
        <Input isRequired type="text" classNames={{
          inputWrapper: "border-none shadow-none",
          input: "focus:outline-none focus:ring-0",
        }} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Descripción<small className="text-sm text-red-500">*</small></label>

        <Textarea
          isRequired
          classNames={{
          inputWrapper: "border-none shadow-none",
          input: "focus:outline-none focus:ring-0",
        }} 
          labelPlacement="outside"
        />
      </div>
    </form>
  );
}
