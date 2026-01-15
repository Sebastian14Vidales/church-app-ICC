import { Users, BookOpen, Calendar, DollarSign, TrendingUp, Heart } from 'lucide-react';


export default function Dashboard() {

  const stats = [
    { name: 'Miembros Activos', value: 1, icon: Users, color: 'bg-blue-500' },
    { name: 'Cursos Activos', value: 2, icon: BookOpen, color: 'bg-green-500' },
    { name: 'Eventos Próximos', value: 3, icon: Calendar, color: 'bg-purple-500' },
    { name: 'Grupos de Vida', value: 4, icon: Heart, color: 'bg-red-500' },
    { name: 'Ofrendas del Mes', value: 5, icon: DollarSign, color: 'bg-yellow-500' }

  ];

  return (
    <div className='space-y-8'>
      <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Panel Pastoral
        </h1>
        <p className="text-blue-100">
          Iglesia Cruzada Cristiana Casa de Dios - {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center">
                <div className={`shrink-0 p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <>
                <button className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-blue-700">Nuevo Miembro</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <BookOpen className="h-8 w-8 text-green-600 mb-2" />
                  <span className="text-sm font-medium text-green-700">Crear Curso</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <Calendar className="h-8 w-8 text-purple-600 mb-2" />
                  <span className="text-sm font-medium text-purple-700">Nuevo Evento</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <TrendingUp className="h-8 w-8 text-yellow-600 mb-2" />
                  <span className="text-sm font-medium text-yellow-700">Ver Reportes</span>
                </button>
              </>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Próximos Eventos</h3>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-center py-4">No hay eventos próximos</p>
          </div>
        </div>
      </div>
    </div>
  )
} 
