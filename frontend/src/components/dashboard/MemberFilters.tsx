import { Button, Input, Select, SelectItem } from "@heroui/react";

export type MemberFiltersValue = {
    baptized: "" | "true" | "false";
    bloodType: string;
    searchTerm: string;
    spiritualGrowthStage: string;
    profession: string;
};

type MemberFiltersProps = {
    filters: MemberFiltersValue;
    onChange: (filters: MemberFiltersValue) => void;
    onClear: () => void;
};

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const SPIRITUAL_GROWTH_STAGES = [
    "Consolidación",
    "Discipulado básico",
    "Carácter cristiano",
    "Sanidad y propósito",
    "Cosmovisión bíblica",
    "Doctrina cristiana",
];

export default function MemberFilters({ filters, onChange, onClear }: MemberFiltersProps) {
    const handleFieldChange = (field: keyof MemberFiltersValue, value: string) => {
        onChange({
            ...filters,
            [field]: value,
        });
    };

    return (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div>
                    <label htmlFor="member-search" className="mb-1 block text-sm font-medium text-gray-700">
                        Documento o nombre
                    </label>
                    <Input
                        id="member-search"
                        type="text"
                        value={filters.searchTerm}
                        onValueChange={(value) => handleFieldChange("searchTerm", value)}
                        placeholder="Busca por documento o nombre"
                        classNames={{ inputWrapper: "border-none shadow-none" }}
                    />
                </div>

                <div>
                    <label htmlFor="member-profession" className="mb-1 block text-sm font-medium text-gray-700">
                        Profesion
                    </label>
                    <Input
                        id="member-profession"
                        type="text"
                        value={filters.profession}
                        onValueChange={(value) => handleFieldChange("profession", value)}
                        placeholder="Busca por profesion"
                        classNames={{ inputWrapper: "border-none shadow-none" }}
                    />
                </div>

                <div>
                    <label htmlFor="member-blood-type" className="mb-1 block text-sm font-medium text-gray-700">
                        Tipo de sangre
                    </label>
                    <Select
                        id="member-blood-type"
                        selectedKeys={filters.bloodType ? [filters.bloodType] : []}
                        onSelectionChange={(keys) => handleFieldChange("bloodType", String(Array.from(keys)[0] ?? ""))}
                        placeholder="Todos"
                    >
                        {BLOOD_TYPES.map((bloodType) => (
                            <SelectItem key={bloodType}>
                                {bloodType}
                            </SelectItem>
                        ))}
                    </Select>
                </div>

                <div>
                    <label htmlFor="member-growth-stage" className="mb-1 block text-sm font-medium text-gray-700">
                        Ruta espiritual
                    </label>
                    <Select
                        id="member-growth-stage"
                        selectedKeys={filters.spiritualGrowthStage ? [filters.spiritualGrowthStage] : []}
                        onSelectionChange={(keys) =>
                            handleFieldChange("spiritualGrowthStage", String(Array.from(keys)[0] ?? ""))
                        }
                        placeholder="Todas"
                    >
                        {SPIRITUAL_GROWTH_STAGES.map((stage) => (
                            <SelectItem key={stage}>
                                {stage}
                            </SelectItem>
                        ))}
                    </Select>
                </div>

                <div>
                    <label htmlFor="member-baptized" className="mb-1 block text-sm font-medium text-gray-700">
                        Bautizado
                    </label>
                    <Select
                        id="member-baptized"
                        selectedKeys={filters.baptized ? [filters.baptized] : []}
                        onSelectionChange={(keys) =>
                            handleFieldChange("baptized", String(Array.from(keys)[0] ?? "") as MemberFiltersValue["baptized"])
                        }
                        placeholder="Todos"
                    >
                        <SelectItem key="true">Si</SelectItem>
                        <SelectItem key="false">No</SelectItem>
                    </Select>
                </div>

                <div className="flex items-end">
                    <Button
                        type="button"
                        onClick={onClear}
                        variant="bordered"
                        className="w-full"
                    >
                        Limpiar filtros
                    </Button>
                </div>
            </div>
        </div>
    );
}
