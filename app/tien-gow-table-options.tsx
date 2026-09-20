'use client';

import type { Table } from '@playroom/tien-gow';
import type { Language } from './language';
import {
  optionDisabled,
  TABLE_OPTIONS,
  togglePlayroomTableOption,
  type TableOptionKey,
} from './tien-gow-table';
import './lab/tien-gow/lab.css';

export function TienGowTableOptions({
  table,
  editable,
  language,
  onChange,
}: {
  table: Table;
  editable: boolean;
  language: Language;
  onChange?: (table: Table) => void;
}) {
  const zh = language === 'zh-Hant';

  function toggle(key: TableOptionKey, checked: boolean) {
    if (!editable || optionDisabled(table, key)) return;
    onChange?.(togglePlayroomTableOption(table, key, checked));
  }

  return (
    <section className="tgw-table-card tgw-lobby-table" aria-label="Table">
      <p className="tgw-kicker">Table</p>
      <div className="tgw-options">
        {TABLE_OPTIONS.map((option) => {
          const disabled = !editable || optionDisabled(table, option.key);
          const label = zh ? option.label : option.labelEn;
          const hint = zh ? option.hint : option.hintEn;
          return (
            <div className="tgw-option" key={option.key}>
              <label>
                <input
                  type="checkbox"
                  checked={table[option.key]}
                  disabled={disabled}
                  aria-label={label}
                  onChange={(event) => toggle(option.key, event.target.checked)}
                />
                {label}
              </label>
              <span className="tgw-tip">
                <button type="button" className="tgw-info" aria-label={`${label}${zh ? '說明' : ' help'}`} aria-describedby={`tgw-play-tip-${option.key}`}>i</button>
                <span className="tgw-tip-panel" role="tooltip" id={`tgw-play-tip-${option.key}`}>{hint}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TienGowTableSummary({ table, language }: { table: Table; language: Language }) {
  const zh = language === 'zh-Hant';
  const on = TABLE_OPTIONS.filter((option) => table[option.key]).map((option) => zh ? option.label : option.labelEn);
  return <p className="tgw-table-summary">Table {on.join(' · ')}</p>;
}
