import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import type { Notification } from "@/types/index";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "hace un momento";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return relativeTimeFormatter.format(-minutes, "minute");

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return relativeTimeFormatter.format(-hours, "hour");

    const days = Math.floor(hours / 24);
    if (days < 30) return relativeTimeFormatter.format(-days, "day");

    const months = Math.floor(days / 30);
    if (months < 12) return relativeTimeFormatter.format(-months, "month");

    const years = Math.floor(months / 12);
    return relativeTimeFormatter.format(-years, "year");
}

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const {
        notifications,
        unreadCount,
        isLoading,
        isError,
        markRead,
        markAllRead,
        isMarkingAllRead,
    } = useNotifications();

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const toggleDropdown = () => setIsOpen((previous) => !previous);

    const handleItemClick = (notification: Notification) => {
        if (!notification.readAt) {
            markRead(notification._id);
        }
        if (notification.link) {
            navigate(notification.link);
        }
        setIsOpen(false);
    };

    const displayCount =
        unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

    const ariaLabel = displayCount
        ? `Notificaciones (${unreadCount} no leídas)`
        : "Notificaciones";

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={toggleDropdown}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className="relative -m-2.5 rounded-full p-2.5 text-gray-500 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
                <Bell className="h-6 w-6" aria-hidden="true" />
                {displayCount && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {displayCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label="Notificaciones"
                    className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96"
                >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() => markAllRead()}
                                disabled={isMarkingAllRead}
                                aria-busy={isMarkingAllRead}
                                className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                            >
                                Marcar todas como leídas
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {isLoading ? (
                            <div className="py-6">
                                <LoadingSpinner
                                    label="Cargando notificaciones..."
                                    className="min-h-[80px]"
                                />
                            </div>
                        ) : isError ? (
                            <div className="flex flex-col items-center px-4 py-6 text-center">
                                <p className="text-sm font-medium text-gray-900">
                                    No pudimos cargar tus notificaciones
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Intenta abrir el panel de nuevo en un momento.
                                </p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center px-4 py-6 text-center">
                                <p className="text-sm font-medium text-gray-900">
                                    No tienes notificaciones
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Te avisaremos cuando haya algo nuevo.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {notifications.map((notification) => (
                                    <li key={notification._id}>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleItemClick(notification)}
                                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                                        >
                                            {!notification.readAt && (
                                                <span
                                                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className={`text-sm ${
                                                        !notification.readAt
                                                            ? "font-semibold text-gray-900"
                                                            : "font-medium text-gray-700"
                                                    }`}
                                                >
                                                    {notification.title}
                                                </p>
                                                <p className="line-clamp-2 text-xs text-gray-600">
                                                    {notification.message}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    {formatRelativeTime(notification.createdAt)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
