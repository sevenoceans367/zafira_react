# Shared UI form kit

Single source for form chrome and common controls. Change height, border, radius, fonts, or colors in one place; pages that use these components pick it up automatically.

## Use from `@bainbridge/shared-ui`

| Need | Component |
|------|-----------|
| Text / search / number | `TextInput` |
| Native select | `Select` |
| Multi-line | `Textarea` |
| Label + control + hint/error | `Field` |
| List-page filter row | `FilterBar` + `FilterField` |
| Buttons | `Button` |
| Header search | `PageHeaderSearch` |
| Calendar (dd-mm-yyyy) | `DmyDateInput` |
| Status chips | `StatusBadge` |

## Rules

1. New UI must use these shared-ui form controls.
2. Do **not** redeclare `.input` / `.filterField` / button chrome in page CSS modules.
3. Design tokens live in `src/global.css`; form layout chrome lives in `src/components/FormControls/FormControls.module.css`.

## Example

```jsx
import {
  Button,
  DmyDateInput,
  Field,
  FilterBar,
  FilterField,
  TextInput,
  Select,
} from '@bainbridge/shared-ui';

<FilterBar
  actions={<Button variant="primary" label="Load" onClick={load} />}
>
  <FilterField id="search" label="Search">
    <TextInput
      id="search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Nom ID, voyage…"
    />
  </FilterField>
  <FilterField id="year" label="Year">
    <Select id="year" value={year} onChange={(e) => setYear(e.target.value)}>
      <option value="2026">2026</option>
    </Select>
  </FilterField>
</FilterBar>

<Field id="eta" label="ETA">
  <DmyDateInput id="eta" value={eta} onChange={setEta} />
</Field>
```
