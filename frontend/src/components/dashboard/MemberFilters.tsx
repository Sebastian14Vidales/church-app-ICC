export type MemberFiltersValue = {
    baptized: "" | "true" | "false";
    bloodType: string;
    searchTerm: string;
};

type MemberFiltersProps = {
    filters: MemberFiltersValue;
    onChange: (filters: MemberFiltersValue) => void;
    onClear: () => void;
};

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export default function MemberFilters({ filters, onChange, onClear }: MemberFiltersProps) {
    const handleFieldChange = (field: keyof MemberFiltersValue, value: string) => {
        onChange({
            ...filters,
            [field]: value,
        });
    };

    return (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                    <label htmlFor="member-search" className="mb-1 block text-sm font-medium text-gray-700">
                        Documento o nombre
                    </label>
                    <input
                        id="member-search"
                        type="text"
                        value={filters.searchTerm}
                        onChange={(event) => handleFieldChange("searchTerm", event.target.value)}
                        placeholder="Busca por documento o nombre"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label htmlFor="member-blood-type" className="mb-1 block text-sm font-medium text-gray-700">
                        Tipo de sangre
                    </label>
                    <select
                        id="member-blood-type"
                        value={filters.bloodType}
                        onChange={(event) => handleFieldChange("bloodType", event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todos</option>
                        {BLOOD_TYPES.map((bloodType) => (
                            <option key={bloodType} value={bloodType}>
                                {bloodType}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="member-baptized" className="mb-1 block text-sm font-medium text-gray-700">
                        Bautizado
                    </label>
                    <select
                        id="member-baptized"
                        value={filters.baptized}
                        onChange={(event) =>
                            handleFieldChange("baptized", event.target.value as MemberFiltersValue["baptized"])
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="">Todos</option>
                        <option value="true">Si</option>
                        <option value="false">No</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={onClear}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        Limpiar filtros
                    </button>
                </div>
            </div>
        </div>
    );
}
