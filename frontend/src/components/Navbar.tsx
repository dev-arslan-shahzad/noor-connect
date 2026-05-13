import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, LogOut, Menu, X, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const dashboardPath = user?.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </span>
          NoorConnect
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link to="/teachers" className="text-foreground/80 hover:text-primary transition">
            Find a Teacher
          </Link>
          <Link to="/nearby" className="text-foreground/80 hover:text-primary transition">
            Nearby Tutors
          </Link>
          <Link to="/register/teacher" className="text-foreground/80 hover:text-primary transition">
            Become a Teacher
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenu((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/40"
              >
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user.full_name ?? user.email}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover shadow-lg p-1">
                  <Link
                    to={dashboardPath}
                    onClick={() => setMenu(false)}
                    className="block rounded px-3 py-2 text-sm hover:bg-accent"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMenu(false);
                      logout();
                      navigate({ to: "/" });
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-foreground/80 hover:text-primary"
              >
                Login
              </Link>
              <Link
                to="/register/student"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-2">
          <Link to="/teachers" onClick={() => setOpen(false)} className="py-2">Find a Teacher</Link>
          <Link to="/nearby" onClick={() => setOpen(false)} className="py-2">Nearby Tutors</Link>
          <Link to="/register/teacher" onClick={() => setOpen(false)} className="py-2">Become a Teacher</Link>
          <div className="border-t border-border pt-2 flex flex-col gap-2">
            {user ? (
              <>
                <Link to={dashboardPath} onClick={() => setOpen(false)} className="py-2">Dashboard</Link>
                <button
                  onClick={() => { setOpen(false); logout(); navigate({ to: "/" }); }}
                  className="text-left py-2 text-destructive"
                >Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="py-2">Login</Link>
                <Link
                  to="/register/student"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-primary px-4 py-2 text-center text-primary-foreground"
                >Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
