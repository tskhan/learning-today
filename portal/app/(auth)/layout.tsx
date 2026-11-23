/** Log in, join, forgot and reset password: the learning-today brand on the left, the form on the right (stacked on phones). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="auth">
      <section className="auth-brand" aria-label="About the portal">
        <a className="auth-logo" href="https://learning-today.com">
          <picture>
            <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
            <img src="/logo.png" alt="learning-today.com" width={490} height={112} />
          </picture>
        </a>
        <p className="kicker">Members only</p>
        <p className="auth-brand-title">Batch 91 Portal</p>
        <ul className="auth-points">
          <li>Catch up on every class: what was discussed, the material and the homework.</li>
          <li>Track your reading and homework in one place.</li>
          <li>Ask classmates questions in one discussion space.</li>
        </ul>
      </section>
      <div className="auth-panel">
        <div className="auth-card">{children}</div>
      </div>
    </main>
  );
}
