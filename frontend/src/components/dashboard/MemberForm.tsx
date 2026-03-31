import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { DatePicker, Input, Select, SelectItem } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { getAllRoles } from "@/api/MemberAPI";
import { type MemberFormData } from "@/types/index";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const BOOLEAN_OPTIONS = [
  { key: "true", label: "Sí" },
  { key: "false", label: "No" },
];
const MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza (Niñas entre 7 y 14 años)",
  "Ministerio de Jóvenes",
  "Ministerio de Servidores",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Hombres",
  "Ministerio de Mujeres",
  "Ministerio de Parejas y Familias",
  "Ministerio Iglesia Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E",
];
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",
  "Discipulado básico",
  "Carácter cristiano",
  "Sanidad y propósito",
  "Cosmovisión bíblica",
  "Doctrina cristiana",
];

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

  const servesInMinistry = useWatch({ control, name: "servesInMinistry" });
  const requiresAccess = LOGIN_ENABLED_ROLES.includes(selectedRole);
  const visibleRoles = roles.filter(
    (role) => !["Admin", "Superadmin"].includes(role.name) || role.name === selectedRole,
  );

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
          {errors.firstName && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Apellidos
          </label>
          <Input
            id="lastName"
            {...register("lastName", { required: true })}
            placeholder="Ingrese los apellidos"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.lastName && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="documentID" className="block text-sm font-medium text-gray-700">
            Documento
          </label>
          <Input
            id="documentID"
            {...register("documentID", {
              required: true,
              minLength: 10,
              maxLength: 10,
              pattern: /^\d{10}$/,
              onChange: (event) => {
                event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
              },
            })}
            placeholder="Ingrese el documento"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.documentID && (
            <span className="text-xs text-red-500">Debe tener exactamente 10 dígitos</span>
          )}
        </div>

        <div>
          <label htmlFor="birthdate" className="block text-sm font-medium text-gray-700">
            Fecha de nacimiento
          </label>
          <Controller
            name="birthdate"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <DatePicker
                value={field.value ? parseDate(field.value) : null}
                onChange={(value) => field.onChange(value ? value.toString() : "")}
                maxValue={today(getLocalTimeZone())}
                className="w-full"
              />
            )}
          />
          {errors.birthdate && <span className="text-xs text-red-500">Este campo es requerido</span>}
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
          {errors.neighborhood && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>

        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <Input
            id="phoneNumber"
            {...register("phoneNumber", {
              required: true,
              minLength: 10,
              maxLength: 10,
              pattern: /^\d{10}$/,
              onChange: (event) => {
                event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
              },
            })}
            placeholder="Ingrese el teléfono"
            classNames={{ inputWrapper: "border-none shadow-none" }}
          />
          {errors.phoneNumber && (
            <span className="text-xs text-red-500">Debe tener exactamente 10 dígitos</span>
          )}
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
          {errors.bloodType && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bautizado</label>
          <Controller
            name="baptized"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                selectedKeys={field.value ? [field.value] : []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                placeholder="Seleccione una opción"
                className="input"
              >
                {BOOLEAN_OPTIONS.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.baptized && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Rol en la Iglesia</label>
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
                {visibleRoles.map((role) => (
                  <SelectItem key={role.name}>{role.name}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.roleName && <span className="text-xs text-red-500">Este campo es requerido</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Ruta de Crecimiento Espiritual</label>
          <Controller
            name="spiritualGrowthStage"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                selectedKeys={field.value ? [field.value] : []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                placeholder="Seleccione una etapa"
                className="input"
              >
                {SPIRITUAL_GROWTH_STAGES.map((stage) => (
                  <SelectItem key={stage}>{stage}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.spiritualGrowthStage && (
            <span className="text-xs text-red-500">Este campo es requerido</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">¿Sirve en algún ministerio?</label>
          <Controller
            name="servesInMinistry"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                selectedKeys={field.value ? [field.value] : []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                placeholder="Seleccione una opción"
                className="input"
              >
                {BOOLEAN_OPTIONS.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.servesInMinistry && (
            <span className="text-xs text-red-500">Este campo es requerido</span>
          )}
        </div>

        <div>
          {servesInMinistry === "true" && (
            <>
              <label className="block text-sm font-medium text-gray-700">¿En qué ministerio sirve?</label>
              <Controller
                name="ministry"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                    placeholder="Seleccione un ministerio"
                    className="input"
                  >
                    {MINISTRIES.map((ministry) => (
                      <SelectItem key={ministry}>{ministry}</SelectItem>
                    ))}
                  </Select>
                )}
              />
            </>
          )}

          {servesInMinistry === "false" && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                ¿En qué ministerio está interesado servir?
              </label>
              <Controller
                name="ministryInterest"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] ?? "")}
                    placeholder="Seleccione un ministerio"
                    className="input"
                  >
                    {MINISTRIES.map((ministry) => (
                      <SelectItem key={ministry}>{ministry}</SelectItem>
                    ))}
                  </Select>
                )}
              />
            </>
          )}

          {!servesInMinistry && (
            <>
              <label className="block text-sm font-medium text-gray-700">Ministerio</label>
              <Input
                isDisabled
                placeholder="Primero selecciona si sirve en algún ministerio"
                classNames={{ inputWrapper: "border-none shadow-none" }}
              />
            </>
          )}

          {(errors.ministry || errors.ministryInterest) && (
            <span className="text-xs text-red-500">Este campo es requerido</span>
          )}
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
              {errors.email && <span className="text-xs text-red-500">Este campo es requerido</span>}
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
