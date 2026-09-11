import { createBrowserRouter, RouterProvider } from "react-router";
import MainLayout from "../shared/layouts/MainLayout";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <MainLayout>
        <h2>Home page</h2>
      </MainLayout>
    )
  }
]);

const AppRoutes = (): JSX.Element => {
  return <RouterProvider router={router} />;
};

export default AppRoutes;
