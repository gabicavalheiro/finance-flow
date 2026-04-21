import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { CustomCategoryProvider } from './contexts/CustomCategoryContext';

createRoot(document.getElementById('root')!).render(
  <CustomCategoryProvider>
    <App />
  </CustomCategoryProvider>
);

