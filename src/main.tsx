import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { AuthProvider } from "./features/auth/auth-context";
import "./styles.css";
const basename = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/$/, "");
createRoot(document.getElementById("root")!).render(<BrowserRouter basename={basename}><AuthProvider><App /></AuthProvider></BrowserRouter>);
