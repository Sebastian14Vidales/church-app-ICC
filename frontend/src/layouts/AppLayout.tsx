import { Outlet } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ToastContainer } from "react-toastify";

export default function AppLayout() {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-100">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Header />
                <main className="flex-1 overflow-y-auto bg-slate-100">
                    <div className="px-4 py-8 sm:px-6 lg:px-8">
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
