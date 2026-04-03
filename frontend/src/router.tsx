import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import PATHS from "@/utils/constants/routes";

export const routes: RouteObject[] = [
  {
    path: PATHS.login,
    lazy: async () => ({
      Component: (await import("@/pages/auth/Login")).default,
    }),
  },
  {
    path: PATHS.confirmAccount,
    lazy: async () => ({
      Component: (await import("@/pages/auth/ConfirmAccount")).default,
    }),
  },
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("@/pages/Dashboard")).default,
        }),
      },
      {
        path: PATHS.courses,
        lazy: async () => ({
          Component: (await import("@/pages/courses/Courses")).default,
        }),
      },
      {
        path: PATHS.members,
        lazy: async () => ({
          Component: (await import("@/pages/members/Members")).default,
        }),
      }
    ],
  },
  {
    path: "*",
    element: <Navigate to={PATHS.dashboard} replace />,
  },
];

export const router = createBrowserRouter(routes);
export default router;
