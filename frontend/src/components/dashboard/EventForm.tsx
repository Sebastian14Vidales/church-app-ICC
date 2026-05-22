
import { DatePicker, Input } from "@heroui/react";

export default function CreateEventForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre del Evento</label>
        <Input className="mt-1" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha</label>
        <DatePicker className="mt-1" />
      </div>
    </form>
  );
}
