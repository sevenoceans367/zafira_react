import { isDbConfigured } from '../config.js';
import {
  dbGetCommercialParameters,
  dbSaveCommercialParameters,
  emptyAtSeaRow,
  emptyInPortRow,
  emptyVariousRow,
} from './commercialParametersDb.js';

const MOCK_DATA = {
  vessel: {
    id: 1001,
    name: 'ATLANTIC STAR',
    type: 'Aframax',
    businessTypeId: 2,
    dwt: '105000',
    draft: '14.5',
    tpc: '98',
  },
  main: {
    date: '09-07-2026',
    dwt: '105000',
    draft: '14.5',
    tpc: '98',
  },
  speed: {
    ballastFull: '14.5',
    ballastService: '13.0',
    ballastEco: '12.0',
    ladenFull: '14.0',
    ladenService: '12.5',
    ladenEco: '11.5',
  },
  bunkersAtSea: [
    {
      key: 'at-sea-1',
      bunkerId: '29',
      zone: 'Non Seca',
      ballastFull: '35',
      ladenFull: '38',
      ballastService: '32',
      ladenService: '34',
      ballastEco: '28',
      ladenEco: '30',
    },
  ],
  bunkersInPort: [
    {
      key: 'in-port-1',
      bunkerId: '29',
      zone: 'Non Seca',
      workingLp: '4',
      workingDp: '5',
      idleBallast: '2',
      idleLaden: '2.5',
    },
  ],
  bunkersVarious: [
    {
      key: 'various-1',
      bunkerId: '29',
      zone: 'Non Seca',
      coldWash: '1',
      hotWash: '2',
      inertGasFree: '3',
      purgeGasFree: '4',
      heatingMaintain: '5',
      heatingRaise: '6',
    },
  ],
  lookups: {
    bunkers: [
      { id: '29', name: 'VLSFO' },
      { id: '11', name: 'HSFO' },
    ],
    zones: [
      { id: 'Non Seca', name: 'Non Seca' },
      { id: 'Seca', name: 'Seca' },
    ],
  },
};

export async function getCommercialParameters(vesselId) {
  if (!isDbConfigured()) {
    return {
      ...MOCK_DATA,
      vessel: { ...MOCK_DATA.vessel, id: Number(vesselId) || MOCK_DATA.vessel.id },
    };
  }
  return dbGetCommercialParameters(vesselId);
}

export async function saveCommercialParameters(vesselId, payload) {
  if (!isDbConfigured()) {
    return { msg: 2, ...MOCK_DATA, vessel: { ...MOCK_DATA.vessel, id: Number(vesselId) } };
  }
  await dbSaveCommercialParameters(vesselId, payload);
  const data = await dbGetCommercialParameters(vesselId);
  return { msg: 2, ...data };
}

export {
  emptyAtSeaRow,
  emptyInPortRow,
  emptyVariousRow,
};
