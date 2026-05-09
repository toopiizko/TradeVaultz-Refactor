import { QueryClient, QueryClientProvider } from “@tanstack/react-query”;
import { ErrorBoundary } from “@/components/ErrorBoundary”;
import { BrowserRouter, Route, Routes } from “react-router-dom”;
import { Toaster as Sonner } from “@/components/ui/sonner”;
import { Toaster } from “@/components/ui/toaster”;
import { TooltipProvider } from “@/components/ui/tooltip”;
import { AuthProvider } from “@/lib/auth”;
import { ThemeProvider } from “@/lib/theme”;
import { PortfolioProvider } from “@/lib/portfolio”;
import { CurrencyProvider } from “@/lib/currency-context”;
import Protected from “@/components/Protected”;
import Index from “./pages/Index”;
import Auth from “./pages/Auth”;
import Trades from “./pages/Trades”;
import CalendarPage from “./pages/CalendarPage”;
import Calculator from “./pages/Calculator”;
import Expenses from “./pages/Expenses”;
import ExpenseCalendar from “./pages/ExpenseCalendar”;
import News from “./pages/News”;
import Portfolios from “./pages/Portfolios”;
import Share from “./pages/Share”;
import NotFound from “./pages/NotFound”;

const queryClient = new QueryClient();

const App = () => (
<ErrorBoundary>
<QueryClientProvider client={queryClient}>
<ThemeProvider>
<TooltipProvider>
<Toaster />
<Sonner />
<BrowserRouter>
<AuthProvider>
<PortfolioProvider>
<CurrencyProvider>
<Routes>
<Route path=”/auth” element={<Auth />} />
<Route path=”/” element={<Protected><Index /></Protected>} />
<Route path=”/trades” element={<Protected><Trades /></Protected>} />
<Route path=”/calendar” element={<Protected><CalendarPage /></Protected>} />
<Route path=”/calculator” element={<Protected><Calculator /></Protected>} />
<Route path=”/expenses” element={<Protected><Expenses /></Protected>} />
<Route path=”/expenses/calendar” element={<Protected><ExpenseCalendar /></Protected>} />
<Route path=”/news” element={<Protected><News /></Protected>} />
<Route path=”/portfolios” element={<Protected><Portfolios /></Protected>} />
<Route path=”/share” element={<Protected><Share /></Protected>} />
<Route path=”*” element={<NotFound />} />
</Routes>
</CurrencyProvider>
</PortfolioProvider>
</AuthProvider>
</BrowserRouter>
</TooltipProvider>
</ThemeProvider>
</QueryClientProvider>
</ErrorBoundary>
);

export default App;
