import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import PATHS from "@/constants/routes";

export const routes: RouteObject[] = [
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
          Component: (await import("@/pages/Courses")).default,
        }),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to={PATHS.dashboard} replace />,
  },
];

export const router = createBrowserRouter(routes);
export default router;
