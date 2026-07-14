import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  isMastersHostModule,
  masterAppPath,
} from '../../../constants/mastersModule.js';
import { resolveMasterPage } from './mastersPageRegistry.js';

export default function MasterModulePage() {
  const { module, masterId } = useParams();
  if (!isMastersHostModule(module)) {
    return <Navigate to={masterAppPath('vc', masterId)} replace />;
  }
  const Page = resolveMasterPage(masterId);
  return <Page />;
}
