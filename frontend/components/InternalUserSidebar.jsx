import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppSidebar } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fleetAppPath } from '../constants/fleetModule.js';
import { periodContractAppPath } from '../constants/periodContractModule.js';
import { elibraryAppPath } from '../constants/elibraryModule.js';
import { userGuidesAppPath } from '../constants/userGuidesModule.js';
import { todoListAppPath } from '../constants/todoListPageHeaders.js';
import { groupPaymentsAppPath } from '../constants/combinedSoaPayablePageHeaders.js';
import { SOPF_TOP_SIDEBAR_ITEMS, SOPF_CHARTERING_SIDEBAR_ITEMS } from '../constants/sopfSidebarMenu.js';
import helpDeskIcon from '../assets/help desk.png';
import commercialPerformanceIcon from '../assets/commercial performance.png';
import genericFinancesIcon from '../assets/generic finances.png';
import financialTransactionsIcon from '../assets/financial transactions.png';
import fleetIcon from '../assets/vessel.png';
import elibraryIcon from '../assets/elibrary.svg';
import timeCharterIcon from '../assets/TIME CHARTER.png';
import periodContractIcon from '../assets/Period contact.svg';
import userGuidesIcon from '../assets/user-guides.svg';
import CoasSidebarTree from './coa/CoasSidebarTree.jsx';
import OpsVcSidebarTree from './ops/OpsVcSidebarTree.jsx';
import OpsTcSidebarTree from './ops/OpsTcSidebarTree.jsx';
import MastersSidebarTree from './masters/MastersSidebarTree.jsx';
import ReportsSidebarTree from './reports/ReportsSidebarTree.jsx';
import vesselPositionIcon from '../assets/vesselPosition.svg';
import {
  LIVE_VESSEL_MAP_ENABLED,
  LIVE_VESSEL_MAP_PATH,
  LIVE_VESSEL_MAP_TITLE,
} from '../pages/internal-user/live-vessel-map/liveVesselMap.feature.js';

function isSidebarItemActive(pathname, item) {
  if (typeof item.isActive === 'function') {
    return item.isActive(pathname);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarLink({ to, icon, iconSrc, iconAlt, label, active, disabled }) {
  const content = (
    <>
      {iconSrc ? (
        <img src={iconSrc} alt={iconAlt || ''} className="icon" aria-hidden={!iconAlt} />
      ) : (
        <i className={`bi ${icon} icon`} aria-hidden />
      )}
      <span>{label}</span>
    </>
  );

  if (disabled) {
    return (
      <li>
        <span className="disabled" aria-disabled="true" title="Coming soon">
          {content}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link to={to} className={active ? 'active' : ''}>
        {content}
      </Link>
    </li>
  );
}

function SidebarSection({ label }) {
  return (
    <li className="sidebar-section" aria-hidden>
      {label}
    </li>
  );
}

const FLEET_LINK = {
  iconSrc: fleetIcon,
  iconAlt: 'Operated Vessels',
  label: 'Operated Vessels',
};

const PERIOD_CONTRACT_LINK = {
  iconSrc: periodContractIcon,
  iconAlt: 'Period',
  label: 'Period',
};

const TIME_CHARTER_LINK = {
  iconSrc: timeCharterIcon,
  iconAlt: 'Time Charter',
  label: 'Time Charter',
};

const ELIBRARY_LINK = {
  iconSrc: elibraryIcon,
  iconAlt: 'E-Library',
  label: 'E-Library',
};

const USER_GUIDES_LINK = {
  iconSrc: userGuidesIcon,
  iconAlt: 'User Guides',
  label: 'User Guides',
};

const TODO_LIST_LINK = {
  iconSrc: financialTransactionsIcon,
  iconAlt: 'Financial Transactions',
  label: 'Financial Transactions',
};

const HELP_DESK_HREF = '/internal-user/sopf/support_ticket';

export default function InternalUserSidebar({ isOpen }) {
  const { pathname: currentPath } = useLocation();
  const inSopf = currentPath.startsWith('/internal-user/sopf');
  const inVc = currentPath.startsWith('/internal-user/vc');
  const inTc = currentPath.startsWith('/internal-user/tc');
  const inLiveVessels = LIVE_VESSEL_MAP_ENABLED
    && currentPath.startsWith(LIVE_VESSEL_MAP_PATH);

  return (
    <AppSidebar isOpen={isOpen}>
      <ul className="sidebar-menu">
        <SidebarSection label={inVc || inTc ? 'SOC' : 'SOPF'} />
        <SidebarLink
          to={appPath(HELP_DESK_HREF)}
          iconSrc={helpDeskIcon}
          iconAlt="Help Desk"
          label="Help Desk"
          active={currentPath.includes(HELP_DESK_HREF)}
        />
        {inVc ? (
          <SidebarLink
            to={appPath('/internal-user/vc')}
            iconSrc={commercialPerformanceIcon}
            iconAlt="Commercial Performance"
            label="Commercial Performance"
            active={currentPath === '/internal-user/vc'}
          />
        ) : null}

        {inLiveVessels ? (
          <>
            <SidebarSection label="LIVE MAP" />
            <SidebarLink
              to={appPath(LIVE_VESSEL_MAP_PATH)}
              iconSrc={vesselPositionIcon}
              iconAlt={LIVE_VESSEL_MAP_TITLE}
              label={LIVE_VESSEL_MAP_TITLE}
              active
            />
          </>
        ) : null}

        {inSopf ? (
          <>
            {SOPF_TOP_SIDEBAR_ITEMS.map((item) => (
              <SidebarLink
                key={item.id}
                to={item.href.startsWith('/') ? appPath(item.href) : item.href}
                icon={item.icon}
                iconSrc={item.iconSrc}
                iconAlt={item.iconAlt}
                label={item.label}
                active={isSidebarItemActive(currentPath, item)}
              />
            ))}
            <SidebarSection label="Chartering activities" />
            {SOPF_CHARTERING_SIDEBAR_ITEMS.map((item) => (
              <React.Fragment key={item.id}>
                <SidebarLink
                  to={item.href.startsWith('/') ? appPath(item.href) : item.href}
                  icon={item.icon}
                  iconSrc={item.iconSrc}
                  iconAlt={item.iconAlt}
                  label={item.label}
                  active={isSidebarItemActive(currentPath, item)}
                  disabled={item.disabled}
                />
                {item.id === 'period' ? (
                  <CoasSidebarTree isOpen={isOpen} />
                ) : null}
              </React.Fragment>
            ))}
          </>
        ) : null}

        {inVc ? (
          <>
            <SidebarSection label="Commercial Operations" />
            <SidebarLink
              to={fleetAppPath('vc')}
              iconSrc={FLEET_LINK.iconSrc}
              iconAlt={FLEET_LINK.iconAlt}
              label={FLEET_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/fleet')}
            />
            <SidebarLink
              to={periodContractAppPath('vc')}
              iconSrc={PERIOD_CONTRACT_LINK.iconSrc}
              iconAlt={PERIOD_CONTRACT_LINK.iconAlt}
              label={PERIOD_CONTRACT_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/period-contracts')}
            />
            <SidebarLink
              to={elibraryAppPath('vc')}
              iconSrc={ELIBRARY_LINK.iconSrc}
              iconAlt={ELIBRARY_LINK.iconAlt}
              label={ELIBRARY_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/elibrary')}
            />
            <SidebarLink
              to={userGuidesAppPath('vc')}
              iconSrc={USER_GUIDES_LINK.iconSrc}
              iconAlt={USER_GUIDES_LINK.iconAlt}
              label={USER_GUIDES_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/user-guides')}
            />
            <SidebarLink
              to={todoListAppPath('vc')}
              iconSrc={TODO_LIST_LINK.iconSrc}
              iconAlt={TODO_LIST_LINK.iconAlt}
              label={TODO_LIST_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/todo-list')}
            />
            <SidebarLink
              to={groupPaymentsAppPath()}
              icon="bi-currency-dollar"
              label="Group Payments"
              active={currentPath.includes('/group-payments')
                || currentPath.includes('/combined-soa-payable')}
            />
            <SidebarLink
              to="/internal-user/vc/generic-finances"
              iconSrc={genericFinancesIcon}
              iconAlt="Generic Finances"
              label="GENERIC FINANCES"
              active={currentPath.startsWith('/internal-user/vc/generic-finances')}
            />
            <CoasSidebarTree isOpen={isOpen} />
            <OpsVcSidebarTree isOpen={isOpen} />
            <OpsTcSidebarTree isOpen={isOpen} />
            <ReportsSidebarTree isOpen={isOpen} />
            <MastersSidebarTree isOpen={isOpen} />
          </>
        ) : null}

        {inTc ? (
          <>
            <SidebarSection label="Commercial Operations" />
            <SidebarLink
              to={appPath('/internal-user/tc')}
              iconSrc={TIME_CHARTER_LINK.iconSrc}
              iconAlt={TIME_CHARTER_LINK.iconAlt}
              label={TIME_CHARTER_LINK.label}
              active={currentPath === '/internal-user/tc'}
            />
            <SidebarLink
              to={fleetAppPath('tc')}
              iconSrc={FLEET_LINK.iconSrc}
              iconAlt={FLEET_LINK.iconAlt}
              label={FLEET_LINK.label}
              active={currentPath.startsWith('/internal-user/tc/fleet')}
            />
            <SidebarLink
              to={periodContractAppPath('tc')}
              iconSrc={PERIOD_CONTRACT_LINK.iconSrc}
              iconAlt={PERIOD_CONTRACT_LINK.iconAlt}
              label={PERIOD_CONTRACT_LINK.label}
              active={currentPath.startsWith('/internal-user/tc/period-contracts')}
            />
            <SidebarLink
              to={elibraryAppPath('tc')}
              iconSrc={ELIBRARY_LINK.iconSrc}
              iconAlt={ELIBRARY_LINK.iconAlt}
              label={ELIBRARY_LINK.label}
              active={currentPath.startsWith('/internal-user/tc/elibrary')}
            />
            <SidebarLink
              to={userGuidesAppPath('tc')}
              iconSrc={USER_GUIDES_LINK.iconSrc}
              iconAlt={USER_GUIDES_LINK.iconAlt}
              label={USER_GUIDES_LINK.label}
              active={currentPath.startsWith('/internal-user/tc/user-guides')}
            />
            <ReportsSidebarTree isOpen={isOpen} />
            <MastersSidebarTree isOpen={isOpen} />
          </>
        ) : null}
      </ul>
    </AppSidebar>
  );
}
