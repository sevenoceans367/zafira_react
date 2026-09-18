import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { agentLogin, getUser, isAuthenticated, isAgentAppUser } from '@bainbridge/shared-auth';
import brandLogo from '../../assets/2026_Seven_Oceans_White_Stacked_Logo.png';
import loginStyles from '../LoginPage.module.css';
import styles from './AgentLoginPage.module.css';

const SUPPORT_EMAIL = 'support@sevenoceans.world';

export default function AgentLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated() && isAgentAppUser(getUser()?.userType)) {
    return <Navigate to="/agent/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await agentLogin(username.trim(), password);
      navigate('/agent/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={loginStyles.page}>
      <LoadingOverlay show={submitting} />

      <div className={loginStyles.shell}>
        <section className={loginStyles.hero} aria-label="Welcome">
          <div className={loginStyles.logoSlot}>
            <Link to={appPath('/login')} aria-label="Back to sign in" className={loginStyles.logoLink}>
              <img
                src={brandLogo}
                alt="Seven Oceans"
                className={loginStyles.logo}
              />
            </Link>
          </div>

          <div className={loginStyles.heroBottom}>
            <div className={loginStyles.heroCopy}>
              <h1 className={loginStyles.headline}>
                Welcome back to the
                <br />
                platform that powers
                <br />
                shipping &amp; cargo
              </h1>
              <p className={loginStyles.lede}>
                One intelligent solution - across every desk covering your global portfolio.
              </p>
            </div>

            <div className={loginStyles.heroActions}>
              <button type="button" className={loginStyles.ghostPill}>
                What&apos;s New
              </button>
              <a
                className={loginStyles.ghostPill}
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                Support
              </a>
              <a
                className={loginStyles.ghostPill}
                href={appPath('/login')}
              >
                Genesis Portal
              </a>
            </div>
          </div>
        </section>

        <section className={loginStyles.cardWrap} aria-label="Agent sign in">
          <div className={loginStyles.card}>
            <p className={loginStyles.eyebrow}>Seven Oceans Agent Portal</p>
            <p className={styles.agentCaption}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Third-Party Agent Access
            </p>
            <h2 className={loginStyles.cardTitle}>Sign In</h2>

            <form className={loginStyles.form} onSubmit={handleSubmit}>
              <div className={loginStyles.field}>
                <label className={loginStyles.label} htmlFor="agent-login-username">Username</label>
                <input
                  id="agent-login-username"
                  type="text"
                  className={loginStyles.input}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="agent.username"
                  required
                />
              </div>

              <div className={loginStyles.field}>
                <label className={loginStyles.label} htmlFor="agent-login-password">Password</label>
                <input
                  id="agent-login-password"
                  type="password"
                  className={loginStyles.input}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div className={loginStyles.row}>
                <label className={loginStyles.remember}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <a className={loginStyles.forgot} href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Agent Portal — Forgot Password')}`}>
                  Forgot Password?
                </a>
              </div>

              {error ? (
                <div className={loginStyles.error} role="alert">{error}</div>
              ) : null}

              <button
                type="submit"
                className={loginStyles.submit}
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
