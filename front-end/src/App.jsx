import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import AppRoutes from "@/routes/AppRoutes";
import "./utilities.css";
import "./App.css";

const App = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
