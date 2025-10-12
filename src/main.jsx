import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Orders from "./pages/Orders";
import UploadPage from "./pages/UploadPage";
import VerifyIdentity from "./pages/VerifyIdentity";
import "./styles/globals.css";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/products", element: <Products /> },
      { path: "/products/:id", element: <ProductDetail /> },
      { path: "/cart", element: <Cart /> },
      { path: "/checkout", element: <Checkout /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/profile", element: <Profile /> },
      { path: "/orders", element: <Orders /> },
      { path: "/verify", element: <VerifyIdentity /> },
      { path: "/upload", element: <UploadPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
