import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { EntryProvider } from "./context/EntryContext";
import { NavProvider } from "./context/NavContext";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <EntryProvider>
            <NavProvider>
              <App />
            </NavProvider>
          </EntryProvider>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
