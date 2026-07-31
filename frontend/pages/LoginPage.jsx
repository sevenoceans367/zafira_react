import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { isAuthenticated, login } from '@bainbridge/shared-auth';
import brandLogo from '../assets/2026_Seven_Oceans_White_Stacked_Logo.png';
import styles from './LoginPage.module.css';

const SUPPORT_EMAIL = 'support@sevenoceans.world';
const VIEW_SIGN_IN = 'signIn';
const VIEW_FORGOT = 'forgot';
const VIEW_FORGOT_SUCCESS = 'forgotSuccess';

const emptyRecovery = {
  fullName: '',
  username: '',
  organisation: '',
  email: '',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState(VIEW_SIGN_IN);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [recovery, setRecovery] = useState(emptyRecovery);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || appPath('/');
  const isForgotFlow = view === VIEW_FORGOT || view === VIEW_FORGOT_SUCCESS;

  if (isAuthenticated()) {
    return <Navigate to={redirectTo} replace />;
  }

  const goSignIn = () => {
    setError('');
    setView(VIEW_SIGN_IN);
  };

  const goForgot = () => {
    setError('');
    setView(VIEW_FORGOT);
  };

  const patchRecovery = (patch) => {
    setRecovery((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverySubmit = (event) => {
    event.preventDefault();
    setError('');

    const name = recovery.fullName.trim() || '(not provided)';
    const user = recovery.username.trim() || '(not provided)';
    const org = recovery.organisation.trim() || '(not provided)';
    const email = recovery.email.trim() || '(not provided)';

    const subject = 'Account Recovery Request';
    const body = [
      `Full Name: ${name}`,
      `Username: ${user}`,
      `Organisation: ${org}`,
      `Email: ${email}`,
    ].join('\n');

    const mailto =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setView(VIEW_FORGOT_SUCCESS);
  };

  return (
    <div className={styles.page}>
      <LoadingOverlay show={submitting} />

      <div className={styles.shell}>
        <section className={styles.hero} aria-label="Welcome">
          <div className={styles.logoSlot}>
            <img
              src={brandLogo}
              alt="Seven Oceans"
              className={styles.logo}
            />
          </div>

          <div className={styles.heroBottom}>
            <div className={styles.heroCopy}>
              {isForgotFlow ? (
                <>
                  <h1 className={styles.headline}>Forgot your password?</h1>
                  <p className={styles.lede}>No stress. We&apos;ll help you get back in.</p>
                </>
              ) : (
                <>
                  <h1 className={styles.headline}>
                    Welcome back to the
                    <br />
                    platform that powers
                    <br />
                    shipping &amp; cargo
                  </h1>
                  <p className={styles.lede}>
                    One intelligent solution - across every desk covering your global portfolio.
                  </p>
                </>
              )}
            </div>

            <div className={styles.heroActions}>
              <button type="button" className={styles.ghostPill}>
                What&apos;s New
              </button>
              <a
                className={styles.ghostPill}
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                Support
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.cardWrap}
          aria-label={isForgotFlow ? 'Account recovery' : 'Sign in'}
        >
          <div className={`${styles.card} ${isForgotFlow ? styles.cardTall : ''}`}>
            {view === VIEW_SIGN_IN ? (
              <>
                <p className={styles.eyebrow}>Seven Oceans Genesis Portal</p>
                <h2 className={styles.cardTitle}>Sign In</h2>

                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="login-username">Username</label>
                    <input
                      id="login-username"
                      type="text"
                      className={styles.input}
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Enter username"
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="login-password">Password</label>
                    <input
                      id="login-password"
                      type="password"
                      className={styles.input}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      required
                    />
                  </div>

                  <div className={styles.row}>
                    <label className={styles.remember}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <button type="button" className={styles.forgot} onClick={goForgot}>
                      Forgot Password?
                    </button>
                  </div>

                  {error ? (
                    <div className={styles.error} role="alert">{error}</div>
                  ) : null}

                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={submitting}
                  >
                    Sign In
                  </button>
                </form>
              </>
            ) : null}

            {view === VIEW_FORGOT ? (
              <form className={styles.form} onSubmit={handleRecoverySubmit}>
                <p className={styles.eyebrow}>Account Recovery</p>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fp-name">Full Name</label>
                  <input
                    id="fp-name"
                    type="text"
                    className={styles.input}
                    autoComplete="name"
                    value={recovery.fullName}
                    onChange={(event) => patchRecovery({ fullName: event.target.value })}
                    placeholder="e.g. Lewis Hamilton"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fp-username">Username</label>
                  <input
                    id="fp-username"
                    type="text"
                    className={styles.input}
                    autoComplete="username"
                    value={recovery.username}
                    onChange={(event) => patchRecovery({ username: event.target.value })}
                    placeholder="e.g. l.hamilton"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fp-org">Organisation</label>
                  <input
                    id="fp-org"
                    type="text"
                    className={styles.input}
                    autoComplete="organization"
                    value={recovery.organisation}
                    onChange={(event) => patchRecovery({ organisation: event.target.value })}
                    placeholder="e.g. Ferrari S.p.A."
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fp-email">Email</label>
                  <input
                    id="fp-email"
                    type="email"
                    className={styles.input}
                    autoComplete="email"
                    value={recovery.email}
                    onChange={(event) => patchRecovery({ email: event.target.value })}
                    placeholder="e.g. lhamilton@ferrari.com"
                  />
                </div>

                <button type="submit" className={styles.submit}>
                  Send Request
                </button>
                <p className={styles.sendNote}>
                  Our team will be in touch to verify and reset your access.
                </p>
                <p className={styles.backLink}>
                  Remember your password?{' '}
                  <button type="button" className={styles.backLinkBtn} onClick={goSignIn}>
                    Back to Sign In
                  </button>
                </p>
              </form>
            ) : null}

            {view === VIEW_FORGOT_SUCCESS ? (
              <div className={styles.successState}>
                <div className={styles.successIcon} aria-hidden="true">✓</div>
                <h2 className={styles.successTitle}>We&apos;ve got your request!</h2>
                <p className={styles.cardSub}>
                  Our team will be in touch to verify and reset your access.
                </p>
                <p className={styles.backLink}>
                  Remember your password?{' '}
                  <button type="button" className={styles.backLinkBtn} onClick={goSignIn}>
                    Back to Sign In
                  </button>
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
