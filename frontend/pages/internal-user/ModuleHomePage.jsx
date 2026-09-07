import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import { getVisibleModules } from '../../constants/internalUserModules.js';
import ModuleTintIcon from '../../components/ModuleTintIcon.jsx';
import tintStyles from '../../components/ModuleTintIcon.module.css';
import styles from './ModuleHomePage.module.css';

const TILE_THEMES = ['themeBlue', 'themeSilver'];

const ACTIVITY_STATS = {
  sopf: [
    { label: 'Estimates in progress', dot: '#F4652C', val: '7', delta: '+2', dir: 'up' },
    { label: 'Awaiting your review', dot: '#D8480F', val: '3', delta: '+1', dir: 'up' },
  ],
  soc: [
    { label: 'Open contracts', dot: '#2E6FE8', val: '12', delta: '+3', dir: 'up' },
    { label: 'Invoices pending approval', dot: '#14919B', val: '6', delta: '-1', dir: 'down' },
  ],
  'live-vessels': [
    { label: 'Tracked vessels', dot: '#274670', val: '—', delta: '', dir: 'up' },
  ],
};

const AI_PROMPTS = [
  'What estimates need my review today?',
  "Summarize this week's SOC contract activity",
];

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function firstNameFrom(user) {
  const full = String(user?.name || user?.username || '').trim();
  if (!full) return 'there';
  return full.split(/\s+/)[0];
}

function displayNameFrom(user) {
  return String(user?.name || user?.username || '').trim() || 'User';
}

function SparkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    </svg>
  );
}

export default function ModuleHomePage() {
  const user = getUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const modules = useMemo(() => getVisibleModules(user), [user]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const aiWrapRef = useRef(null);
  const aiInputRef = useRef(null);

  const firstName = firstNameFrom(user);
  const displayName = displayNameFrom(user);
  const accessCount = modules.length;

  const activityRows = useMemo(() => (
    modules.flatMap((module) => (
      (ACTIVITY_STATS[module.id] || []).map((stat) => ({
        ...stat,
        moduleId: module.id,
        code: module.subtitle,
        href: module.href,
      }))
    ))
  ), [modules]);

  const activityTotal = useMemo(
    () => activityRows.reduce((sum, row) => sum + (parseInt(row.val, 10) || 1), 0),
    [activityRows],
  );

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!aiWrapRef.current?.contains(event.target)) setAiOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const goToModule = (href) => {
    if (!href) return;
    navigate(appPath(href));
  };

  const handleActivityClick = async (row) => {
    const ok = await confirm({
      title: 'Enter feature',
      message: `Enter ${row.code}'s "${row.label}" feature?`,
      confirmLabel: 'Go',
      cancelLabel: 'Close',
    });
    if (ok) goToModule(row.href);
  };

  const quickLinks = useMemo(() => {
    const links = [];
    const sopf = modules.find((m) => m.id === 'sopf');
    const soc = modules.find((m) => m.id === 'soc');
    if (sopf) {
      links.push({
        label: 'New Spot Estimate — SOPF',
        href: '/internal-user/sopf/addestimate?selBType=2&estimatetype=2',
        icon: 'plus',
      });
    }
    if (soc) {
      links.push({
        label: "Today's Positions — SOC",
        href: soc.href,
        icon: 'calendar',
      });
    }
    return links;
  }, [modules]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.bgSplash} aria-hidden>
        <span className={styles.splash1} />
        <span className={styles.splash2} />
      </div>

      <div className={styles.accessLine}>
        <span>
          Viewing as <b>{displayName}</b>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <span>
          you have access to <b>{accessCount}</b> product{accessCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLine1}>
          {greetingForNow()}, <span className={styles.accentName}>{firstName}</span>.
        </div>
        <div className={styles.heroLine2}>What would you like to do today?</div>
      </div>

      <div className={styles.aiBarWrap} ref={aiWrapRef}>
        <div
          className={styles.aiBar}
          role="search"
          onClick={() => {
            setAiOpen(true);
            aiInputRef.current?.focus();
          }}
        >
          <SparkIcon className={styles.aiSpark} />
          <input
            ref={aiInputRef}
            className={styles.aiInput}
            value={aiQuery}
            placeholder="Ask AI or search across your products — vessels, contracts, estimates, fixtures..."
            onChange={(event) => setAiQuery(event.target.value)}
            onFocus={() => setAiOpen(true)}
            aria-expanded={aiOpen}
            aria-controls="home-ai-dropdown"
          />
          <button
            type="button"
            className={aiOpen ? `${styles.aiChev} ${styles.aiChevOpen}` : styles.aiChev}
            aria-label={aiOpen ? 'Hide suggestions' : 'Show suggestions'}
            onClick={(event) => {
              event.stopPropagation();
              setAiOpen((open) => !open);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {aiOpen ? (
          <div className={styles.aiDropdown} id="home-ai-dropdown" role="listbox">
            <div className={styles.aiDdLabel}>Ask AI</div>
            {AI_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className={styles.aiDdRow}
                onClick={() => {
                  setAiQuery(prompt);
                  setAiOpen(false);
                }}
              >
                <SparkIcon />
                {prompt}
              </button>
            ))}
            {quickLinks.length ? (
              <>
                <div className={styles.aiDdDivider} />
                <div className={styles.aiDdLabel}>Quick Links</div>
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    className={styles.aiDdRow}
                    to={appPath(link.href)}
                    onClick={() => setAiOpen(false)}
                  >
                    {link.icon === 'plus' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    )}
                    {link.label}
                  </Link>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.activityCard}>
        <div className={styles.activityHead}>
          <h3>Across your products</h3>
          <span className={styles.period}>Last 24 hours</span>
        </div>
        {activityRows.length ? (
          <>
            <div className={styles.segBar} aria-hidden>
              {activityRows.map((row) => (
                <span
                  key={`${row.moduleId}-${row.label}`}
                  style={{
                    width: `${(((parseInt(row.val, 10) || 1) / activityTotal) * 100).toFixed(1)}%`,
                    background: row.dot,
                  }}
                />
              ))}
            </div>
            {activityRows.map((row) => (
              <button
                key={`${row.moduleId}-${row.label}`}
                type="button"
                className={styles.statRow}
                onClick={() => handleActivityClick(row)}
              >
                <span className={styles.dot} style={{ background: row.dot }} />
                <span className={styles.lbl}>{row.label}</span>
                <span className={styles.src}>· {row.code}</span>
                <span className={styles.val}>{row.val}</span>
                {row.delta ? (
                  <span className={row.dir === 'up' ? `${styles.delta} ${styles.deltaUp}` : `${styles.delta} ${styles.deltaDown}`}>
                    {row.dir === 'up' ? '↑' : '↓'} {row.delta}
                  </span>
                ) : null}
              </button>
            ))}
          </>
        ) : (
          <div className={styles.activityEmpty}>No activity to show yet.</div>
        )}
      </div>

      <div className={styles.sectionLabel}>Seven Oceans Genesis</div>
      {modules.length ? (
        <div className={styles.cardGrid}>
          {modules.map((module, index) => {
            const theme = TILE_THEMES[index % TILE_THEMES.length];
            return (
              <button
                key={module.id}
                type="button"
                className={`${styles.prodCard} ${styles[theme]}`}
                onClick={() => goToModule(module.href)}
              >
                {module.iconSrc ? (
                  <ModuleTintIcon
                    src={module.iconSrc}
                    alt=""
                    className={`${tintStyles.icon} ${styles.prodIcon}`}
                  />
                ) : null}
                <div className={styles.prodCardContent}>
                  <div className={styles.prodEyebrow}>{module.title}</div>
                  <div className={styles.prodTitle}>{module.subtitle}</div>
                  <div className={styles.prodDesc}>{module.description}</div>
                </div>
                <div className={styles.prodArrow} aria-hidden>→</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.noAccessNote}>No product access is configured for your account.</div>
      )}

      <button
        type="button"
        className={styles.assistFab}
        aria-label="Ask AI"
        onClick={() => {
          setAiOpen(true);
          aiInputRef.current?.focus();
        }}
      >
        <SparkIcon />
      </button>
    </div>
  );
}
