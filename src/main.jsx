import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/responsive.css";   // ← mobile responsive (siempre último)

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
