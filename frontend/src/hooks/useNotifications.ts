import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/api/NotificationAPI";

const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export const useNotifications = () => {
    const queryClient = useQueryClient();

    const {
        data,
        isLoading,
        isError,
    } = useQuery({
        queryKey: NOTIFICATIONS_QUERY_KEY,
        queryFn: () => getMyNotifications(20),
        refetchInterval: 60_000,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        },
    });

    const markAllReadMutation = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        },
    });

    return {
        notifications: data?.items ?? [],
        unreadCount: data?.unreadCount ?? 0,
        isLoading,
        isError,
        markRead: markReadMutation.mutate,
        markAllRead: markAllReadMutation.mutate,
        isMarkingRead: markReadMutation.isPending,
        isMarkingAllRead: markAllReadMutation.isPending,
    };
};
