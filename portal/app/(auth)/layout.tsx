import { Logo } from "@/app/components/Header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="auth">
      <div className="auth-card">
        <Logo />
        {children}
      </div>
    </main>
  );
}
