import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  TrendingUp,
  PieChart,
  Search,
  LogIn,
  ShieldCheck,
  FlaskConical,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileModal } from "./ProfileModal";
import { LoginModal } from "./LoginModal";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}
export const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const { isAuthenticated, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const tabs = [
    { id: "research", label: "Research", icon: FlaskConical },
    { id: "explore", label: "Market", icon: Search },
    { id: "portfolio", label: "Portfolio", icon: PieChart },
  ];
  const admin = user?.role?.toLowerCase() === "admin";
  const account = (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        isAuthenticated ? setIsProfileOpen(true) : setIsLoginOpen(true)
      }
    >
      {isAuthenticated ? (
        <User className="mr-2 h-4 w-4" />
      ) : (
        <LogIn className="mr-2 h-4 w-4" />
      )}
      {isAuthenticated ? "Profile" : "Login"}
    </Button>
  );
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:p-3"
      >
        Skip to workspace
      </a>
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-52 flex-col border-r bg-card">
        <Link
          to="/"
          className="flex h-20 items-center gap-3 px-6 font-semibold tracking-tight text-xl"
        >
          <TrendingUp className="h-6 w-6" />
          Stonks<span className="text-muted-foreground">/</span>
        </Link>
        <p className="eyebrow px-6 mb-3 mt-4">Workspace</p>
        <nav aria-label="Desktop navigation" className="space-y-1 px-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={activeTab === id ? "page" : undefined}
              className="nav-item w-full"
              onClick={() => onTabChange(id)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        {admin && (
          <div className="mt-8 px-3 space-y-1">
            <p className="eyebrow px-3 mb-3">Administration</p>
            <Link
              className="nav-item"
              aria-current={activeTab === "operations" ? "page" : undefined}
              to="/admin"
            >
              <ShieldCheck className="h-4 w-4" />
              Operations
            </Link>
            <button
              className="nav-item w-full"
              aria-current={activeTab === "approvals" ? "page" : undefined}
              onClick={() => onTabChange("approvals")}
            >
              <CheckSquare className="h-4 w-4" />
              Asset approvals
            </button>
          </div>
        )}
        <div className="mt-auto border-t p-5 space-y-4">
          <div className="eyebrow">Simulated exchange</div>
          {account}
          <p className="text-xs text-muted-foreground">
            Trade. Experiment. Understand.
          </p>
        </div>
      </aside>
      <div className="md:pl-52 min-w-0">
        <header className="flex h-16 items-center justify-between gap-2 border-b px-4 md:px-7">
          <Link to="/" className="md:hidden text-lg font-semibold">
            Stonks <span className="text-muted-foreground">/</span>
          </Link>
          <div className="hidden md:flex gap-2 text-xs text-muted-foreground">
            <span>WORKSPACE</span>
            <span>/</span>
            <span className="text-foreground uppercase">
              {activeTab === "explore" ? "Market" : activeTab}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline eyebrow">
              Research & exchange
            </span>
            {admin && (
              <Link to="/admin" className="md:hidden text-xs underline">
                Operations
              </Link>
            )}
            <span className="md:hidden">{account}</span>
          </div>
        </header>
        <main id="workspace" className="min-w-0 pb-24 md:pb-8">
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center gap-1 py-3 text-xs border-t-2 ${activeTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      <ProfileModal
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        onRequestLoginOpen={() => setIsLoginOpen(true)}
      />
      <LoginModal open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </div>
  );
};
