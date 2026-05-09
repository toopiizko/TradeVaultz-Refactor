import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Calculator, Wallet, Calendar, Newspaper, LogOut, TrendingUp, Menu, Plus, Sun, Moon, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PortfolioSwitcher } from "@/components/PortfolioSwitcher";
import { WalletSwitcher } from "@/components/WalletSwitcher";
import { useState } from "react";

const portfolioNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trade History", icon: BookOpen },
  { to: "/calendar", label: "P&L Calendar", icon: Calendar },
  { to: "/calculator", label: "Calculator", icon: Calculator },
];

const insightNav = [
  { to: "/news", label: "Economic News", icon: Newspaper },
];

const expenseNav = [
  { to: "/expenses", label: "Expense Dashboard", icon: Wallet },
  { to: "/expenses/calendar", label: "Expense Calendar", icon: CalendarDays },
];

const allNav = [...portfolioNav, ...insightNav, ...expenseNav];

function NavItem({ to, label, icon: Icon, onClick }: any) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? "bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isExpensesArea = location.pathname.startsWith("/expenses");

  // Bottom bar: context-aware Calendar links to expense calendar when in expense area
  const bottomNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/trades", label: "Trades", icon: BookOpen },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    isExpensesArea
      ? { to: "/expenses/calendar", label: "Calendar", icon: CalendarDays }
      : { to: "/calendar", label: "Calendar", icon: Calendar },
  ];
  const leftNav = bottomNav.slice(0, 2);
  const rightNav = bottomNav.slice(2);

  // Context-aware FAB: in expenses area trigger Add Expense, otherwise Add Trade
  const handleFab = () => {
    if (isExpensesArea) navigate("/expenses?new=1");
    else navigate("/trades?new=1");
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold tracking-tight truncate">TradeVaultz</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pro Journal</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="h-8 w-8 shrink-0">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>


        <div className="px-3 pt-3">
          <p className="px-1 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {isExpensesArea ? "Wallet" : "Portfolio"}
          </p>
          {isExpensesArea ? <WalletSwitcher /> : <PortfolioSwitcher />}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">Portfolio</p>
          {portfolioNav.map((item) => <NavItem key={item.to} {...item} />)}
          <p className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">Insight</p>
          {insightNav.map((item) => <NavItem key={item.to} {...item} />)}
          <p className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">Expense</p>
          {expenseNav.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center justify-between px-3 gap-2 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex justify-center">
          {isExpensesArea ? <WalletSwitcher compact /> : <PortfolioSwitcher compact />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-sidebar border-border/60">
            <div className="flex flex-col h-full pt-6">
              <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Menu</p>
              <nav className="space-y-1 flex-1">
                {allNav.map((item) => (
                  <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
                ))}
              </nav>
              <div className="border-t border-border/60 pt-3">
                <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav with center FAB */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur-xl border-t border-border/60">
        <div className="grid grid-cols-5 items-end relative">
          {leftNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}

          {/* Center FAB */}
          <div className="flex justify-center">
            <button
              onClick={handleFab}
              aria-label="Add new trade"
              className="-mt-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-background transition-transform active:scale-95"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Plus className="h-6 w-6 text-primary-foreground" />
            </button>
          </div>

          {rightNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
