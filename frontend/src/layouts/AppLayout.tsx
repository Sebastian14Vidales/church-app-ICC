import { Outlet } from "react-router-dom"
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

export default function AppLayout() {
    return (
       <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 overflow-y-auto bg-gray-50">
                    <div className='p-6'>
                        <Outlet />
                    </div>
                </main>
            </div>
       </div>
    );
}

