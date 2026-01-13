import logo from '../../assets/logo.png';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Home,
    BookOpen,
    Users,
    Calendar,
    DollarSign,
    Heart,
    BarChart3,
    LogOut
} from 'lucide-react';

export default function Sidebar() {

    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: Home },
        { name: 'Cursos', href: '/courses', icon: BookOpen },
        { name: 'Miembros', href: '/members', icon: Users },
        { name: 'Eventos', href: '/events', icon: Calendar },
        { name: 'Ofrendas', href: '/offerings', icon: DollarSign },
        { name: 'Grupos de Vida', href: '/life-groups', icon: Heart },
        { name: 'Reportes', href: '/reports', icon: BarChart3 },
    ];
  return (
     <div className="min-h-screen flex">
            <aside className="hidden lg:flex w-72 flex-col bg-linear-to-b from-blue-900 to-blue-800">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4">
                    <div className="flex h-16 items-center mt-4">
                        <img src={logo} alt="Imagen de la iglesia" className='h-8 w-8' />
                        {/* <Church className="h-8 w-8 text-yellow-400" /> */}
                        <div className="ml-3">
                            <h1 className="text-lg font-bold text-white">Iglesia Cruzada Cristiana Casa de Dios</h1>
                            {/* <p className="text-xs text-blue-200">Casa de Dios</p> */}
                        </div>
                    </div>

                    <nav className="flex flex-1 flex-col">
                        <ul className="flex flex-1 flex-col gap-y-7">
                            <li>
                                <ul className="-mx-2 space-y-1">
                                    {navigation.map((item) => {
                                        const isActive = location.pathname === item.href;
                                        return (
                                            <li key={item.name}>
                                                <NavLink
                                                    to={item.href}
                                                    className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold transition-colors ${isActive
                                                            ? 'bg-blue-700 text-white'
                                                            : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                                                        }`}
                                                >
                                                    <item.icon className="h-6 w-6" />
                                                    {item.name}
                                                </NavLink>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>

                            <li className="mt-auto">
                                <div className="bg-blue-800/50 rounded-lg p-4 mb-4">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center">
                                            <span className="text-sm font-medium text-blue-900">PJP</span>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-white">Pastor Juan Perez</p>
                                            <p className="text-xs text-blue-200 capitalize">Pastor</p>
                                        </div>
                                    </div>
                                </div>

                                <button className="group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold text-blue-200 hover:bg-blue-700 hover:text-white">
                                    <LogOut className="h-6 w-6" />
                                    Cerrar Sesión
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </aside>
        </div>
  )
}
