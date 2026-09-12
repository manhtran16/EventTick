import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";   // <-- add this
import App from "./App";

// Bật/tắt dữ liệu giả bằng biến VITE_USE_MOCK trong file .env (mặc định: bật)
if (import.meta.env.VITE_USE_MOCK !== "false") {
  await import("./lib/mockApi");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
