import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            NoorConnect
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Learn Quran online with verified teachers. Trusted by thousands of families.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/teachers">Find a Teacher</Link></li>
            <li><Link to="/nearby">Nearby Tutors</Link></li>
            <li><Link to="/register/student">Sign Up</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Teach</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/register/teacher">Become a Teacher</Link></li>
            <li><Link to="/login">Teacher Login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>About</li>
            <li>Contact</li>
            <li>Privacy</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NoorConnect. All rights reserved.
      </div>
    </footer>
  );
}
