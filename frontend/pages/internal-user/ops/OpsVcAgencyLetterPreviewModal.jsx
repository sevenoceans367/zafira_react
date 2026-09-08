import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import shippingLogo from '../../../assets/progress_shipping.svg';
import styles from './OpsVcAgencyLetterPreviewModal.module.css';

const SPEC_LABELS = [
  'cargo grade',
  'quantity & tolerance',
  'quantity and tolerance',
  'temperature req',
  'temperature requirements',
  'max allowable draft',
];

const LETTER_META = {
  pda: {
    title: 'PDA Request Letter — Preview',
    heading: 'PDA REQUEST LETTER',
    sub: 'Performa Disbursement Account Request',
    accent: 'orange',
    pdfType: 'pda',
    refPrefix: 'PDA',
  },
  nomination: {
    title: 'Agency Nomination Letter — Preview',
    heading: 'AGENCY NOMINATION LETTER',
    sub: 'Appointment of Port Agent',
    accent: 'blue',
    pdfType: 'nomination',
    refPrefix: 'NOM',
  },
  'agent-bunker': {
    title: 'Bunkers Stemmed (Agent) — Preview',
    heading: 'BUNKERS STEMMED',
    sub: 'Letter to Agents',
    accent: 'teal',
    pdfType: 'agent-bunker',
    refPrefix: 'BNK-A',
  },
  voyage: {
    title: 'Voyage Instructions Letter — Preview',
    heading: 'VOYAGE INSTRUCTIONS',
    sub: 'Letter to Master',
    accent: 'amber',
    pdfType: 'voyage',
    refPrefix: 'VOY',
  },
  'master-bunker': {
    title: 'Bunkers Stemmed (Master) — Preview',
    heading: 'BUNKERS STEMMED',
    sub: 'Letter to Master',
    accent: 'teal',
    pdfType: 'master-bunker',
    refPrefix: 'BNK-M',
  },
};

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function dash(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function formatDisplayDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  // Already human-ish (dd-mm-yyyy …)
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function parseVoyageLetterText(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const specs = [];
  const ops = [];
  blocks.forEach((block) => {
    const match = block.match(/^([^\n:]{1,60}):\s*([\s\S]*)$/);
    const label = match ? match[1].trim() : '';
    const value = match ? match[2].trim() : block;
    if (label && SPEC_LABELS.includes(label.toLowerCase())) {
      specs.push({ label, value });
    } else {
      ops.push(block);
    }
  });
  return { specs, ops };
}

function LetterFooter({ companyName, companyPhone, companyEmail, companyWebsite, companyAddress }) {
  return (
    <div className={styles.ltrDocFoot}>
      <div className={styles.ltrDocFootChip} aria-hidden />
      <div className={styles.ltrDocFootText}>
        <b>{companyName || 'Progress Shipping'}</b>
        {' '}
        · {companyAddress || 'Singapore'}
        {companyPhone ? ` · Tel: ${companyPhone}` : ''}
        <br />
        {companyEmail || 'ops@progressshipping.com'}
        {' · '}
        {companyWebsite || 'www.sevenoceans.world'}
      </div>
    </div>
  );
}

function LetterShell({ accentClass, heading, sub, refCode, dateLabel, footer, children }) {
  return (
    <div className={styles.ltrDocWrap}>
      <div className={styles.ltrDoc}>
        <div className={styles.ltrDocBody}>
          <div className={styles.ltrDocHead}>
            <div>
              <div className={`${styles.ltrDocH1} ${accentClass}`}>{heading}</div>
              <div className={styles.ltrDocSub}>{sub}</div>
            </div>
            <img className={styles.ltrDocLogo} src={shippingLogo} alt="" aria-hidden />
          </div>
          <div className={styles.ltrDocBarwrap}>
            <div className={styles.ltrDocBar}>
              <span>Ref: {refCode}</span>
              <span>Date: {dateLabel}</span>
            </div>
            <div className={styles.ltrDocBarAccent} />
          </div>
          {children}
        </div>
        <LetterFooter {...(footer || {})} />
      </div>
    </div>
  );
}

function PdaPreview({ ctx }) {
  const vessel = ctx.vessel || {};
  return (
    <LetterShell
      accentClass={styles.accentOrange}
      heading={LETTER_META.pda.heading}
      sub={LETTER_META.pda.sub}
      refCode={ctx.refCode}
      dateLabel={ctx.dateLabel}
      footer={ctx.footer}
    >
      <div className={styles.ltrDocTofrom}>
        <div>
          <div className={styles.ltrDocLabel}>To</div>
          <div className={styles.ltrDocVal}>
            <b>The Port Agents</b>
            <br />
            {dash(ctx.portLabel)}
            <br />
            Attn: Operations
          </div>
        </div>
        <div>
          <div className={styles.ltrDocLabel}>From</div>
          <div className={styles.ltrDocVal}>
            <b>Seven Oceans / {ctx.companyName || 'Progress Shipping'}</b>
            <br />
            Operations Department
            <br />
            Voyage {dash(ctx.nomId)}
          </div>
        </div>
      </div>
      <div className={styles.ltrDocRe}>
        Re: M/V “{dash(ctx.vesselName)}” — Voyage {dash(ctx.nomId)}
      </div>
      <div className={styles.ltrDocGreeting}>
        Good day,
        <br />
        Dear Sirs,
        <br />
        <br />
        We are working on a possible loading at {dash(ctx.portLabel)} for {dash(ctx.cargoName)}
        {ctx.qty ? `, ${ctx.qty} MT` : ''}
        {ctx.tolerance ? ` (+/- ${ctx.tolerance})` : ''}.
        <br />
        <br />
        Please revert with your best Performa DA on basis following vessel’s particulars:
      </div>
      <div className={styles.ltrDocTable}>
        {[
          ['LOA (M)', vessel.loa],
          ['BOA (M)', vessel.breadth],
          ['MAX S.DRAFT (M)', vessel.draft],
          ['DWT (MT)', vessel.dwt],
          ['GRT', vessel.grt],
          ['NRT', vessel.nrt],
        ].map(([label, value]) => (
          <div key={label}>
            <div className={styles.tl}>{label}</div>
            <div className={styles.tv}>{dash(value)}</div>
          </div>
        ))}
      </div>
      <div className={styles.ltrDocMsg}>
        Please quote ALL IN agency fee. In addition, please advise the usual port restrictions for this vessel type.
      </div>
      <div className={styles.ltrDocSignoff}>
        Best regards,
        <br />
        <br />
        <b>{ctx.contactPerson || 'Operations'}</b>
        <br />
        Operations, {ctx.companyName || 'Progress Shipping'}
      </div>
      <div className={styles.ltrDocPortal}>
        <div className={styles.ltrDocPortalH}>Agent Portal Access</div>
        <div>Please log in to the agent portal to submit your PDA response directly:</div>
        <div className={styles.ltrDocPortalCred}>
          Username: {dash(ctx.username)}
          {'  '}
          Password: {dash(ctx.password)}
        </div>
        <a
          className={styles.ltrDocPortalLink}
          href={ctx.agentLoginUrl || 'https://zafira.sevenoceans.net.in/login'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Click here to log in
        </a>
      </div>
      <div className={styles.ltrDocGenby}>
        This letter was generated on the Seven Oceans platform on behalf of Progress Shipping.
      </div>
    </LetterShell>
  );
}

function NominationPreview({ ctx }) {
  const portKind = String(ctx.portType || '').toUpperCase().startsWith('DP') ? 'discharge' : 'load';
  return (
    <LetterShell
      accentClass={styles.accentBlue}
      heading={LETTER_META.nomination.heading}
      sub={LETTER_META.nomination.sub}
      refCode={ctx.refCode}
      dateLabel={ctx.dateLabel}
      footer={ctx.footer}
    >
      <div className={styles.ltrDocTofrom}>
        <div>
          <div className={styles.ltrDocLabel}>To</div>
          <div className={styles.ltrDocVal}>
            <b>{dash(ctx.agentName)}</b>
            <br />
            {dash(ctx.portLabel)}
            {ctx.contactLine ? (
              <>
                <br />
                Attn: {ctx.contactLine}
              </>
            ) : null}
          </div>
        </div>
        <div>
          <div className={styles.ltrDocLabel}>From</div>
          <div className={styles.ltrDocVal}>
            <b>Seven Oceans / Progress Shipping</b>
            <br />
            Operations Department
            <br />
            Nom ID {dash(ctx.nomId)}
          </div>
        </div>
      </div>
      <div className={styles.ltrDocRe}>
        Re: M/V “{dash(ctx.vesselName)}” — Voyage {dash(ctx.nomId)}
      </div>
      <div className={styles.ltrDocGreeting}>
        Good day,
        <br />
        <br />
        We are glad to appoint you as our agents for handling cargo operations for subject vessel,
        which shows ETA on/around {dash(ctx.etaDate1)} IAGW.
        <br />
        <br />
        Vessel expected to {portKind} about {dash(ctx.qty)} MTS (subject to master&apos;s stow plan) of{' '}
        {dash(ctx.cargoName)} in Bulk at the port of {dash(ctx.portName)}.
      </div>
      {ctx.letterText ? <div className={styles.ltrDocMsg}>{ctx.letterText}</div> : null}
      {ctx.masterName ? (
        <div className={styles.ltrDocMsg}>Master / terms: {ctx.masterName}</div>
      ) : null}
      <div className={styles.ltrDocSignoff}>
        Best regards,
        <br />
        <br />
        <b>Operations</b>
        <br />
        Progress Shipping
      </div>
      <div className={styles.ltrDocPortal}>
        <div className={styles.ltrDocPortalH}>Agent Portal Access</div>
        <div>Please log in to the agent portal for nomination follow-up:</div>
        <div className={styles.ltrDocPortalCred}>
          Username: {dash(ctx.username)}
          {'  '}
          Password: {dash(ctx.password)}
        </div>
      </div>
      <div className={styles.ltrDocGenby}>
        This letter was generated on the Seven Oceans platform on behalf of Progress Shipping.
      </div>
    </LetterShell>
  );
}

function BunkerPreview({ ctx, audience }) {
  const bunkerPort = ctx.bunkerPortLabel || ctx.portLabel;
  const rows = ctx.bunkers?.length
    ? ctx.bunkers
    : [{ grade: '—', supplier: '—', physical: '—', quantity: '—' }];
  return (
    <LetterShell
      accentClass={styles.accentTeal}
      heading={LETTER_META[audience === 'master' ? 'master-bunker' : 'agent-bunker'].heading}
      sub={LETTER_META[audience === 'master' ? 'master-bunker' : 'agent-bunker'].sub}
      refCode={ctx.refCode}
      dateLabel={ctx.dateLabel}
      footer={ctx.footer}
    >
      <div className={styles.ltrDocTofrom}>
        <div>
          <div className={styles.ltrDocLabel}>To</div>
          <div className={styles.ltrDocVal}>
            <b>{audience === 'master' ? 'The Master' : dash(ctx.agentName)}</b>
            <br />
            {audience === 'master' ? `M/V “${dash(ctx.vesselName)}”` : dash(bunkerPort)}
            <br />
            Voyage {dash(ctx.nomId)}
          </div>
        </div>
        <div>
          <div className={styles.ltrDocLabel}>From</div>
          <div className={styles.ltrDocVal}>
            <b>Seven Oceans / Progress Shipping</b>
            <br />
            Operations Department
          </div>
        </div>
      </div>
      <div className={styles.ltrDocRe}>
        Re: Bunker supply — M/V “{dash(ctx.vesselName)}” at {dash(bunkerPort)}
      </div>
      <div className={styles.ltrDocGreeting}>
        Good day,
        <br />
        <br />
        {audience === 'master'
          ? `Please note the bunker supply arranged for subject vessel at ${dash(bunkerPort)}. Vessel ETA around ${dash(ctx.bunkerEta)} LT.`
          : `As owners/disponent owners of the captioned vessel, we are pleased to consign the vessel to your agency during her bunker supply at ${dash(bunkerPort)}. Vessel ETA around ${dash(ctx.bunkerEta)} LT.`}
      </div>
      {ctx.letterText ? <div className={styles.ltrDocMsg}>{ctx.letterText}</div> : null}
      <div className={styles.voySectionH}>Bunker supply details</div>
      <div className={styles.voyTableWrap}>
        <table className={styles.voyTable}>
          <thead>
            <tr>
              <th>Grade</th>
              <th>Supplier</th>
              <th>Physical</th>
              <th>Quantity (MT)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`bunker-preview-${index}`}>
                <td>{dash(row.grade)}</td>
                <td>{dash(row.supplier)}</td>
                <td>{dash(row.physical)}</td>
                <td>{dash(row.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(ctx.bunkerSurveyor || ctx.bunkerSurveyorCom) ? (
        <div className={styles.ltrDocMsg}>
          Bunker surveyor: {[ctx.bunkerSurveyor, ctx.bunkerSurveyorCom].filter(Boolean).join(' — ')}
        </div>
      ) : null}
      <div className={styles.ltrDocSignoff}>
        Best regards,
        <br />
        <br />
        <b>Operations</b>
        <br />
        Progress Shipping
      </div>
      <div className={styles.ltrDocGenby}>
        This letter was generated on the Seven Oceans platform on behalf of Progress Shipping.
      </div>
    </LetterShell>
  );
}

function VoyagePreview({ ctx }) {
  const { specs, ops } = useMemo(() => parseVoyageLetterText(ctx.letterText), [ctx.letterText]);
  const rotation = ctx.portRotation?.length
    ? ctx.portRotation
    : [{ port: ctx.portLabel, event: 'Load / Discharge', eta: ctx.etaDate1, agent: ctx.agentName }];

  return (
    <LetterShell
      accentClass={styles.accentAmber}
      heading={LETTER_META.voyage.heading}
      sub={LETTER_META.voyage.sub}
      refCode={ctx.refCode}
      dateLabel={ctx.dateLabel}
      footer={ctx.footer}
    >
      <div className={styles.ltrDocTofrom}>
        <div>
          <div className={styles.ltrDocLabel}>To</div>
          <div className={styles.ltrDocVal}>
            <b>The Master</b>
            <br />
            M/V “{dash(ctx.vesselName)}”
            <br />
            Voyage {dash(ctx.nomId)}
          </div>
        </div>
        <div>
          <div className={styles.ltrDocLabel}>From</div>
          <div className={styles.ltrDocVal}>
            <b>Seven Oceans / {ctx.companyName || 'Progress Shipping'}</b>
            <br />
            Operations Department
            <br />
            {dash(ctx.portLabel)}
          </div>
        </div>
      </div>
      <div className={styles.ltrDocRe}>
        Re: Voyage Instructions — M/V “{dash(ctx.vesselName)}”, Voyage {dash(ctx.nomId)}
      </div>
      <div className={styles.ltrDocGreeting}>
        Dear Sir,
        <br />
        The next voyage has been fixed as follows. Please follow the enclosed voyage instructions.
      </div>

      <div className={styles.voyInfoGrid}>
        {[
          ['Vessel Name', ctx.vesselName],
          ['Voyage No', ctx.nomId],
          ['Charterer', ctx.charterer || '—'],
          ['Charter Party Date', ctx.cpDate || '—'],
          ['Cargo', ctx.cargoName],
          ['Load / Disch Ports', ctx.portsSummary || ctx.portLabel],
          ['Commercial Ops', ctx.companyEmail || 'ops@progressshipping.com'],
          ['Broker / Ref', ctx.refCode],
        ].map(([label, value]) => (
          <div key={label} className={styles.voyInfoCell}>
            <div className={styles.voyInfoL}>{label}</div>
            <div className={styles.voyInfoV}>{dash(value)}</div>
          </div>
        ))}
      </div>

      <div className={styles.voySectionH}>Port Rotation</div>
      <div className={styles.voyTableWrap}>
        <table className={styles.voyTable}>
          <thead>
            <tr>
              <th>Port / Location</th>
              <th>Event / Operation</th>
              <th>Est. Arrival</th>
              <th>Agent Appointed</th>
            </tr>
          </thead>
          <tbody>
            {rotation.map((row, index) => (
              <tr key={`rot-${index}`}>
                <td>{dash(row.port)}</td>
                <td>{dash(row.event)}</td>
                <td>{dash(row.eta)}</td>
                <td>{dash(row.agent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.voySectionH}>Cargo Specs and Instructions</div>
      <div className={styles.voyTableWrap}>
        <table className={`${styles.voyTable} ${styles.voyTableSpecs}`}>
          <tbody>
            {specs.length ? specs.map((row) => (
              <tr key={row.label}>
                <td className={styles.voySpecLabel}>{row.label}</td>
                <td>{row.value}</td>
              </tr>
            )) : (
              <>
                <tr>
                  <td className={styles.voySpecLabel}>Cargo Grade</td>
                  <td>{dash(ctx.cargoName)}</td>
                </tr>
                <tr>
                  <td className={styles.voySpecLabel}>Quantity &amp; Tolerance</td>
                  <td>
                    {[
                      ctx.qty ? `${ctx.qty} Metric Tons` : '',
                      ctx.tolerance ? `(+/- ${ctx.tolerance})` : '',
                    ].filter(Boolean).join(' ') || '—'}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className={`${styles.voySectionH} ${styles.voySectionHAmber}`}>
        Operational and Reporting Instructions
      </div>
      <div className={styles.ltrDocInstr}>
        {ops.length
          ? ops.map((block) => (
            <div key={block.slice(0, 40)} className={styles.voyOpsPara}>{block}</div>
          ))
          : (
            <div className={styles.voyOpsPara}>
              Please acknowledge receipt and confirm compliance at your earliest convenience.
            </div>
          )}
      </div>

      <div className={styles.ltrDocSignoff}>
        Best regards,
        <br />
        <br />
        <b>{ctx.contactPerson || 'Operations'}</b>
        <br />
        Operations, {ctx.companyName || 'Progress Shipping'}
      </div>
      <div className={styles.ltrDocGenby}>
        This letter was generated on the Seven Oceans platform on behalf of Progress Shipping.
      </div>
    </LetterShell>
  );
}

export default function OpsVcAgencyLetterPreviewModal({
  open,
  letterId,
  onClose,
  form,
  activePort,
  draft,
  comId,
  pdfRecord,
}) {
  const meta = LETTER_META[letterId] || LETTER_META.pda;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const ctx = useMemo(() => {
    if (!form || !activePort || !draft) return null;
    const portLabel = [activePort.portName, draft.countryId
      ? (form.lookups?.countries || []).find((c) => String(c.id) === String(draft.countryId))?.name
      : '']
      .filter(Boolean)
      .join(', ') || activePort.tabLabel || '—';
    const contact = (draft.entities || []).find((row) => row.name || row.email) || {};
    const contactLine = [contact.name, contact.email ? `(${contact.email})` : ''].filter(Boolean).join(' ');
    const letterText = letterId === 'voyage' || letterId === 'master-bunker'
      ? (draft.masterLetterText || draft.cargoDetails || '')
      : (draft.agentLetterText || '');
    const portsSummary = (form.ports || [])
      .map((port) => port.portName)
      .filter(Boolean)
      .join(' / ');
    const portRotation = (form.ports || []).map((port) => ({
      port: port.portName || port.tabLabel,
      event: port.portType === 'DP' ? 'Discharge' : 'Load Cargo',
      eta: port.etaNoon || port.etaFixture || '',
      agent: port.agentName || '',
    }));
    const firstBunker = (draft.bunkers || []).find((row) => row.bunkerPort || row.grade) || {};
    const bunkerPortName = (form.lookups?.ports || [])
      .find((p) => String(p.id) === String(firstBunker.bunkerPort))?.name
      || firstBunker.bunkerPort
      || '';

    return {
      nomId: form.nomId,
      vesselName: form.vesselName,
      vessel: form.vessel || {},
      cargoName: form.cargoDefault || draft.cargoDetails || 'cargo',
      charterer: form.chartererName || '',
      cpDate: form.cpDate || '',
      portType: activePort.portType,
      portName: activePort.portName,
      portLabel,
      portsSummary,
      portRotation,
      agentName: activePort.agentName || 'No agent on cost sheet',
      contactLine,
      qty: draft.qty,
      tolerance: draft.tolerance,
      etaDate1: draft.etaDate1,
      masterName: draft.masterName,
      username: draft.username,
      password: draft.password,
      letterText,
      bunkers: draft.bunkers || [],
      bunkerEta: draft.etaDate || draft.etaDate1,
      bunkerSurveyor: draft.bunkerSurveyor,
      bunkerSurveyorCom: draft.bunkerSurveyorCom,
      bunkerPortLabel: bunkerPortName || portLabel,
      dateLabel: formatDisplayDate(draft.date),
      refCode: `GVL/${meta.refPrefix}/${form.nomId || '—'}/${String(activePort.portName || 'PORT').slice(0, 4).toUpperCase()}`,
      companyName: form.companyName || 'Progress Shipping',
      companyEmail: form.companyEmail || 'ops@progressshipping.com',
      contactPerson: form.contactPerson || '',
      agentLoginUrl: form.agentLoginUrl || 'https://zafira.sevenoceans.net.in/login',
      footer: {
        companyName: form.companyName || 'Progress Shipping',
        companyPhone: form.companyPhone || '+65 6123 4567',
        companyEmail: form.companyEmail || 'ops@progressshipping.com',
        companyWebsite: form.companyWebsite || 'www.sevenoceans.world',
        companyAddress: form.companyAddress || 'Singapore',
      },
    };
  }, [form, activePort, draft, letterId, meta.refPrefix]);

  const pdfHref = useMemo(() => {
    if (!meta.pdfType || !pdfRecord?.genAgencyId || !comId || !activePort) return '';
    const params = new URLSearchParams({
      type: meta.pdfType,
      genAgencyId: pdfRecord.genAgencyId,
      portType: pdfRecord.portType || activePort.portType || '',
      comId,
      portId: pdfRecord.portId || activePort.portId || '',
      agentCode: pdfRecord.vendorId || activePort.agentCode || '',
      randomId: pdfRecord.randomId || activePort.randomId || '',
    });
    return `/api/internal-user/vc/ops/agency-letter/${encodeURIComponent(pdfRecord.genAgencyId)}/pdf?${params}`;
  }, [meta.pdfType, pdfRecord, comId, activePort]);

  const emailHref = useMemo(() => {
    if (!ctx) return '';
    const emails = (draft?.entities || [])
      .map((row) => row.email)
      .filter(Boolean)
      .join(',');
    const subject = encodeURIComponent(`${meta.heading} — ${ctx.vesselName || ''} / ${ctx.nomId || ''}`);
    const body = encodeURIComponent(
      `Please find the ${meta.heading.toLowerCase()} for M/V ${ctx.vesselName || ''} voyage ${ctx.nomId || ''}.\n\n`
      + `${ctx.letterText || ''}\n`,
    );
    return `mailto:${emails}?subject=${subject}&body=${body}`;
  }, [ctx, draft, meta.heading]);

  if (!open || !ctx) return null;

  let body = null;
  if (letterId === 'pda') body = <PdaPreview ctx={ctx} />;
  else if (letterId === 'nomination') body = <NominationPreview ctx={ctx} />;
  else if (letterId === 'agent-bunker') body = <BunkerPreview ctx={ctx} audience="agent" />;
  else if (letterId === 'master-bunker') body = <BunkerPreview ctx={ctx} audience="master" />;
  else body = <VoyagePreview ctx={ctx} />;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={meta.title}>
        <div className={styles.head}>
          <div className={styles.titleWrap}>
            <div className={styles.titleIco}>
              <DocIcon />
            </div>
            <div>
              <div className={styles.title}>{meta.title}</div>
              <div className={styles.subtitle}>
                <span className={`${styles.chipPort} ${styles[`chipPort${activePort.portType}`] || ''}`}>
                  {activePort.portType}
                </span>
                {ctx.portLabel}
                {' · '}
                Voyage {dash(ctx.nomId)}
                {' · '}
                {dash(ctx.vesselName)}
              </div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          {body}
          <div className={styles.actions}>
            {pdfHref ? (
              <a
                className={styles.iconBtn}
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Download PDF"
              >
                <DownloadIcon />
              </a>
            ) : (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDisabled}`}
                title={meta.pdfType ? 'Save the letter first to download PDF' : 'PDF download is not available for this letter type yet'}
                disabled
              >
                <DownloadIcon />
              </button>
            )}
            <a
              className={`${styles.iconBtn} ${styles.iconBtnSend}`}
              href={emailHref}
              title="Email as Attachment"
            >
              <EmailIcon />
              <span>Email</span>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { LETTER_META };
