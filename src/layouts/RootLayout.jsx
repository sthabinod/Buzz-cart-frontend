import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function RootLayout() {
  return (
    <div className="app">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
