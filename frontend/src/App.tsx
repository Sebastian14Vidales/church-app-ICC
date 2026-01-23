import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { HeroUIProvider } from "@heroui/react";

function App() {
  return (
    <HeroUIProvider>
      <RouterProvider router={router} />
    </HeroUIProvider>
  );
}

export default App;
