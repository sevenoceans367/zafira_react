import React from 'react';
import { useParams } from 'react-router-dom';
import { resolveMasterPage } from './mastersPageRegistry.js';

export default function MasterModulePage() {
  const { masterId } = useParams();
  const Page = resolveMasterPage(masterId);
  return <Page />;
}
