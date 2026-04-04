import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { GuestOnly, RequireAuth } from "@/components/auth/RouteGuards";
import AppLayout from "@/layouts/AppLayout";
import PATHS from "@/utils/constants/routes";

export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      {
        path: PATHS.login,
        lazy: async () => ({
          Component: (await import("@/pages/auth/Login")).default,
        }),
      },
      {
        path: PATHS.forgotPassword,
        lazy: async () => ({
          Component: (await import("@/pages/auth/ForgotPassword")).default,
        }),
      },
      {
        path: PATHS.resendConfirmation,
        lazy: async () => ({
          Component: (await import("@/pages/auth/ResendConfirmation")).default,
        }),
      },
      {
        path: PATHS.newPassword,
        lazy: async () => ({
          Component: (await import("@/pages/auth/NewPassword")).default,
        }),
      },
      {
        path: PATHS.confirmAccount,
        lazy: async () => ({
          Component: (await import("@/pages/auth/ConfirmAccountAccess")).default,
        }),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
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
            path: PATHS.members,
            lazy: async () => ({
              Component: (await import("@/pages/members/Members")).default,
            }),
          },
          {
            element: <RequireAuth allowedRoles={["Admin", "Superadmin"]} />,
            children: [
              {
                path: PATHS.courses,
                lazy: async () => ({
                  Component: (await import("@/pages/courses/Courses")).default,
                }),
              },
            ],
          },
          {
            element: <RequireAuth allowedRoles={["Profesor", "Pastor"]} />,
            children: [
              {
                path: PATHS.myCourses,
                lazy: async () => ({
                  Component: (await import("@/pages/courses/MyCourses")).default,
                }),
              },
              {
                path: PATHS.attendance,
                lazy: async () => ({
                  Component: (await import("@/pages/courses/Attendance")).default,
                }),
              },
            ],
          },
        ],
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
