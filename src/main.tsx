// CSS phải là import ĐẦU TIÊN để đảm bảo Tailwind styles
// được inject trước khi bất kỳ component nào render
import "./index.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
