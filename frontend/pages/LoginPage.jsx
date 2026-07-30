import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { isAuthenticated, login } from '@bainbridge/shared-auth';
import brandLogo from '../assets/2026_Seven_Oceans_White_Stacked_Logo.png';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || appPath('/');

  if (isAuthenticated()) {
    return <Navigate to={redirectTo} replace />;
  }

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
              <h1 className={styles.headline}>
                Welcome back to the
                <br />
                platform that powers
                <br />
                shipping &amp; cargo
              </h1>
              <p className={styles.lede}>
                One intelligent solution – across every desk covering your global portfolio.
              </p>
            </div>

            <div className={styles.heroActions}>
              <button type="button" className={styles.ghostPill}>
                What&apos;s New
              </button>
              <button type="button" className={styles.ghostPill}>
                Support
              </button>
            </div>
          </div>
        </section>

        <section className={styles.cardWrap} aria-label="Sign in">
          <div className={styles.card}>
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
                <button type="button" className={styles.forgot}>
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
          </div>
        </section>
      </div>
    </div>
  );
}
