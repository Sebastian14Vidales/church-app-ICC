
export default function CreateMemberForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre</label>
        <input type="text" className="mt-1 block w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Correo</label>
        <input type="email" className="mt-1 block w-full border rounded p-2" />
      </div>
    </form>
  );
}
