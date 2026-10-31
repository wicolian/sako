import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ClientShell } from "../components/client/ClientShell";
import { ProductTour } from "../components/ProductTour";
import { ProductTourProvider } from "../contexts/ProductTourContext";
import { connectSocket, disconnectSocket } from "../lib/socket";

export const ClientLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  // Normalize paths for navigation highlighting
  let normalizedPath = location.pathname;
  if (location.pathname.startsWith("/tasks/")) {
    normalizedPath = "/tasks";
  }

  return (
    <ProductTourProvider>
      <ProductTour />
      <ClientShell
        currentRoute={normalizedPath}
        onNavigate={(route) => navigate(route)}
      >
        <Outlet />
      </ClientShell>
    </ProductTourProvider>
  );
};


