import { Outlet } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ToastContainer } from "react-toastify";

export default function AppLayout() {
    return (
        <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 overflow-y-auto bg-gray-50">
                    <div className='px-4 sm:px-6 lg:px-8 py-8'>
                        <Outlet />
                    </div>
                </main>

                <ToastContainer
                    pauseOnHover={false}
                    pauseOnFocusLoss={false}
                    autoClose={2000}
                    theme="dark"
                />
            </div>
        </div>
    );
}

