import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Input, Select, SelectItem } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getAllRoles } from "@/api/MemberAPI";
import { type MemberFormData } from "@/types/index";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

type MemberFormProps = {
  register: UseFormRegister<MemberFormData>;
  errors: FieldErrors<MemberFormData>;
  control: Control<MemberFormData>;
  selectedRole: MemberFormData["roleName"];
};

export default function MemberForm({
  register,
  errors,
  control,
  selectedRole,
}: MemberFormProps) {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: getAllRoles,
  });

  const requiresAccess = LOGIN_ENABLED_ROLES.includes(selectedRole);

  return (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <Input
            id="firstName"
            {...register("firstName", { required: true })}
            placeholder="Ingrese el nombre"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.firstName && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Apellido
          </label>
          <Input
            id="lastName"
            {...register("lastName", { required: true })}
            placeholder="Ingrese el apellido"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.lastName && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="documentID" className="block text-sm font-medium text-gray-700">
            Documento
          </label>
          <Input
            id="documentID"
            {...register("documentID", { required: true })}
            placeholder="Ingrese el documento"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.documentID && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>

        <div>
          <label htmlFor="birthdate" className="block text-sm font-medium text-gray-700">
            Fecha de nacimiento
          </label>
          <Input
            id="birthdate"
            {...register("birthdate", { required: true })}
            type="date"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.birthdate && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700">
            Barrio
          </label>
          <Input
            id="neighborhood"
            {...register("neighborhood", { required: true })}
            placeholder="Ingrese el barrio"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.neighborhood && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>

        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <Input
            id="phoneNumber"
            {...register("phoneNumber", { required: true })}
            placeholder="Ingrese el teléfono"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.phoneNumber && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de sangre</label>
          <Controller
            name="bloodType"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                selectedKeys={field.value ? [field.value] : []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                placeholder="Seleccione el tipo de sangre"
                className="input"
              >
                {BLOOD_TYPES.map((bloodType) => (
                  <SelectItem key={bloodType}>{bloodType}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.bloodType && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Rol</label>
          <Controller
            name="roleName"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                isLoading={isLoading}
                selectedKeys={field.value ? [field.value] : []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                placeholder="Seleccione un rol"
                className="input"
              >
                {roles.map((role) => (
                  <SelectItem key={role.name}>{role.name}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.roleName && <span className="text-red-500 text-xs">Este campo es requerido</span>}
        </div>
      </div>

      {requiresAccess && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-900">
            Este rol tendrá acceso al login. Debes registrar correo y puedes definir una contraseña temporal.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo
              </label>
              <Input
                id="email"
                {...register("email", { required: requiresAccess })}
                type="email"
                placeholder="correo@iglesia.com"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
              {errors.email && <span className="text-red-500 text-xs">Este campo es requerido</span>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña temporal
              </label>
              <Input
                id="password"
                {...register("password")}
                type="text"
                placeholder="Temporal123*"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
