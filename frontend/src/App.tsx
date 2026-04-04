import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { HeroUIProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SessionOverlay from "@/components/auth/SessionOverlay";
import RealtimeBridge from "@/components/auth/RealtimeBridge";
import { AuthProvider } from "@/lib/auth";

const queryClient = new QueryClient()
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HeroUIProvider>
          <RealtimeBridge />
          <SessionOverlay />
          <RouterProvider router={router} />
        </HeroUIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
