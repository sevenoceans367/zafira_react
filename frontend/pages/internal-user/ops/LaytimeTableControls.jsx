import React, { useEffect, useState } from 'react';
import { RowActions, RowAddButton, RowDelButton } from '@bainbridge/shared-ui';
import { LAYTIME_TANKER_PAGE_SIZE, filterRowsByQuery } from './laytimeTankerHelpers.js';
import { paginateRows } from './sofTankerHelpers.js';

export function TableRowActions({ locked, onInsert, onDelete }) {
  if (locked) return null;
  return (
    <RowActions>
      <RowAddButton title="Insert row below" onClick={onInsert} />
      {onDelete && <RowDelButton onClick={onDelete} />}
    </RowActions>
  );
}

export function usePagedSearch(rows, fields, portKey, entity = '') {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = LAYTIME_TANKER_PAGE_SIZE;
  const matches = filterRowsByQuery(rows, search, fields);
  const filtered = entity ? matches.filter(({ row }) => row.entity === entity) : matches;
  const paged = paginateRows(filtered, page, pageSize);

  useEffect(() => {
    setPage(1);
  }, [portKey]);

  useEffect(() => {
    if (page > paged.totalPages) setPage(paged.totalPages);
  }, [page, paged.totalPages]);

  return {
    search,
    setSearch: (value) => { setSearch(value); setPage(1); },
    page: paged.safePage,
    setPage,
    pageSize,
    items: paged.items,
    filteredCount: filtered.length,
  };
}
