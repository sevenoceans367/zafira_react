import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import sopfIcon from '../../assets/SOPF Icon 1.png';
import socIcon from '../../assets/SOC Product Icon.png';
import ModuleTintIcon from '../../components/ModuleTintIcon.jsx';
import tintStyles from '../../components/ModuleTintIcon.module.css';
import styles from './ModuleHomePage.module.css';

const HOME_CARDS = [
  {
    id: 'sopf',
    title: 'Seven Oceans PreFix',
    code: 'SOPF',
    description: 'Analyse the most profitable fixtures across the book',
    href: '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2',
    iconSrc: sopfIcon,
    theme: 'themeBlue',
  },
  {
    id: 'hedgex',
    title: 'HedgeX',
    code: 'HedgeX',
    description: 'Manage your book’s exposure & hedge live contracts',
    href: '',
    theme: 'themeSilver',
  },
  {
    id: 'soc',
    title: 'Seven Ocean Commercials',
    code: 'SOC',
    description: 'Run the backbone of your portfolio → end-to-end voyage management',
    href: '/internal-user/vc',
    iconSrc: socIcon,
    theme: 'themeBlue',
  },
  {
    id: 'sofa',
    title: 'Seven Oceans Finance & Accounting',
    code: 'SOFA',
    description: 'Unified financial and portfolio metrics, beyond voyage contracts.',
    href: '',
    theme: 'themeSilver',
  },
];

function HomeCardIcon({ card }) {
  if (card.iconSrc) {
    return (
      <ModuleTintIcon
        src={card.iconSrc}
        alt=""
        className={`${tintStyles.icon} ${styles.prodIcon}`}
      />
    );
  }
  if (card.id === 'hedgex') {
    return (
      <svg className={styles.prodIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="2" y="7" width="17" height="11" rx="1.5" />
        <circle cx="10.5" cy="12.5" r="2" />
        <path d="M14 9l7-4-1.5 4.5" />
      </svg>
    );
  }
  return (
    <svg className={styles.prodIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 18v-6M7 18V6M11 18v-4" />
      <circle cx="15.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <path d="M17.5 18v-6" />
      <circle cx="21" cy="9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const DEMO_ROLES = [
  { id: 'superuser', label: 'Super User', cards: ['sopf', 'hedgex', 'soc', 'sofa'] },
  { id: 'commercial', label: 'Commercial', cards: ['sopf', 'hedgex', 'soc'] },
  { id: 'chartering', label: 'Chartering', cards: ['sopf'] },
  { id: 'finance', label: 'Finance', cards: ['sofa'] },
];

const ACTIVITY_STATS = {
  sopf: [
    { label: 'Estimates in progress', dot: '#F4652C', val: '7', delta: '+2', dir: 'up' },
    { label: 'Awaiting your review', dot: '#D8480F', val: '3', delta: '+1', dir: 'up' },
  ],
  soc: [
    { label: 'Open contracts', dot: '#2E6FE8', val: '12', delta: '+3', dir: 'up' },
    { label: 'Invoices pending approval', dot: '#14919B', val: '6', delta: '-1', dir: 'down' },
  ],
  sofa: [
    { label: 'Month-end close', dot: '#A9791E', val: '4 days', delta: '', dir: 'up' },
  ],
  hedgex: [
    { label: 'Positions expiring this week', dot: '#5B4FE0', val: '3', delta: '+1', dir: 'up' },
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [demoRole, setDemoRole] = useState('superuser');
  const aiWrapRef = useRef(null);
  const aiInputRef = useRef(null);

  const firstName = firstNameFrom(user);
  const displayName = displayNameFrom(user);
  const visibleCards = useMemo(() => {
    const allowed = DEMO_ROLES.find((role) => role.id === demoRole)?.cards || [];
    return HOME_CARDS.filter((card) => allowed.includes(card.id));
  }, [demoRole]);
  const accessCount = visibleCards.length;

  const activityRows = useMemo(() => (
    visibleCards.flatMap((card) => (
      (ACTIVITY_STATS[card.id] || []).map((stat) => ({
        ...stat,
        moduleId: card.id,
        code: card.code,
        href: card.href,
      }))
    ))
  ), [visibleCards]);

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
    const sopf = visibleCards.find((card) => card.id === 'sopf');
    const soc = visibleCards.find((card) => card.id === 'soc');
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
  }, [visibleCards]);

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
        <label className={styles.demoRole}>
          <span>Demo view</span>
          <Select
            size="sm"
            className={styles.demoRoleSelect}
            value={demoRole}
            aria-label="Demo view"
            onChange={(event) => setDemoRole(event.target.value)}
          >
            {DEMO_ROLES.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </Select>
        </label>
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
          <div className={styles.activityEmpty}>No activity to show for this role yet.</div>
        )}
      </div>

      <div className={styles.sectionLabel}>Seven Oceans Genesis</div>
      <div className={styles.cardGrid}>
        {visibleCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`${styles.prodCard} ${styles[card.theme]}`}
            onClick={() => goToModule(card.href)}
          >
            <HomeCardIcon card={card} />
            <div className={styles.prodCardContent}>
              <div className={styles.prodEyebrow}>{card.title}</div>
              <div className={styles.prodTitle}>{card.code}</div>
              <div className={styles.prodDesc}>{card.description}</div>
            </div>
            <div className={styles.prodArrow} aria-hidden>→</div>
          </button>
        ))}
      </div>

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
