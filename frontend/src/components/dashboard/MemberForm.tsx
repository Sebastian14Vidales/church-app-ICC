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
import { useAuth } from "@/lib/auth";
import { type MemberFormData } from "@/types/index";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor", "Supervisor"];
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
};

export default function MemberForm({
  register,
  errors,
  control,
}: MemberFormProps) {
  const { user } = useAuth();
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: getAllRoles,
  });

  const servesInMinistry = useWatch({ control, name: "servesInMinistry" });
  const selectedRoleNames = useWatch({ control, name: "roleNames" }) || [];
  const requiresAccess = selectedRoleNames.some((role) =>
    LOGIN_ENABLED_ROLES.includes(role)
  );
  const isRestrictedMemberManager =
    user?.roles.includes("Profesor") || user?.roles.includes("Pastor") || user?.roles.includes("Supervisor");
  const visibleRoles = roles.filter((role) => {
    if (isRestrictedMemberManager) {
      return ["Asistente", "Miembro"].includes(role.name);
    }
    return !["Admin", "Superadmin"].includes(role.name);
  });

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
                aria-label="Fecha de nacimiento"
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
                aria-label="Tipo de sangre"
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
                aria-label="Bautizado"
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
          <label className="block text-sm font-medium text-gray-700">Roles en la Iglesia</label>
          <Controller
            name="roleNames"
            control={control}
            rules={{
              validate: (value) =>
                Array.isArray(value) && value.length > 0 ? true : "Selecciona al menos un rol",
            }}
            render={({ field }) => (
              <Select
                isLoading={isLoading}
                selectionMode="multiple"
                selectedKeys={field.value || []}
                onSelectionChange={(keys) => field.onChange(Array.from(keys))}
                placeholder="Selecciona uno o varios roles"
                aria-label="Roles en la Iglesia"
                className="input"
              >
                {visibleRoles.map((role) => (
                  <SelectItem key={role.name}>{role.name}</SelectItem>
                ))}
              </Select>
            )}
          />
          {errors.roleNames && <span className="text-xs text-red-500">{errors.roleNames.message}</span>}
          <p className="mt-1 text-xs text-slate-500">
            Puedes seleccionar varios roles. El sistema definirá automáticamente el rol principal del perfil.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                aria-label="Ruta de Crecimiento Espiritual"
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
                aria-label="¿Sirve en algún ministerio?"
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
                    aria-label="¿En qué ministerio sirve?"
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
                    aria-label="¿En qué ministerio está interesado servir?"
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
            Este rol tendrá acceso al login. Solo debes registrar el correo; el sistema enviará un
            enlace seguro para que la persona active su cuenta y defina su contraseña final.
          </p>

          <div>
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
          </div>
        </div>
      )}
    </div>
  );
}
