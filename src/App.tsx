import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexPRD4 from "./pages/IndexPRD4";
import Admin from "./pages/Admin";
import AdminAuthGate from "./components/AdminAuthGate";
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import DebugPanel from "./components/DebugPanel";
import { debugLogger } from "./services/debugLogger";

// Init debug logger based on URL params
debugLogger.init();

const queryClient = new QueryClient();
const LatencyTelemetryPreview = import.meta.env.DEV ? lazy(() => import("./dev/LatencyTelemetryPreview")) : null;
const RAGConfigPreview = import.meta.env.DEV ? lazy(() => import("./dev/RAGConfigPreview")) : null;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndexPRD4 />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="/admin" element={<AdminAuthGate><Admin /></AdminAuthGate>} />
          {LatencyTelemetryPreview && <Route path="/__preview/latency-telemetry" element={<Suspense fallback={null}><LatencyTelemetryPreview /></Suspense>} />}
          {RAGConfigPreview && <Route path="/__preview/rag-config" element={<Suspense fallback={null}><RAGConfigPreview /></Suspense>} />}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      {debugLogger.enabled && <DebugPanel />}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
