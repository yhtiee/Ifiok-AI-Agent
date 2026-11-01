"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

// AG Grid for the admin tables (12 §4 Q63): sortable, filterable lists of payouts and bookings.
// Themed with Ifiok's tokens only (CSS variables, so dark mode follows), no colours of its own.
// Admin-only, so the grid's size never reaches a student screen.

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "var(--quantity)",
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--ink)",
  textColor: "var(--ink)",
  subtleTextColor: "var(--ink-2)",
  borderColor: "var(--line)",
  headerBackgroundColor: "var(--paper)",
  headerTextColor: "var(--ink-2)",
  oddRowBackgroundColor: "var(--surface)",
  rowHoverColor: "var(--quantity-soft)",
  selectedRowBackgroundColor: "var(--quantity-soft)",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  headerFontSize: 14,
  rowHeight: 48,
  headerHeight: 44,
  wrapperBorderRadius: 12,
  borderRadius: 6,
  wrapperBorder: true,
  spacing: 6,
});

export type { ColDef };

export function AdminGrid<T>(props: {
  rows: T[];
  columns: ColDef<T>[];
  /** Accessible name for the table. */
  label: string;
  getRowId?: (row: T) => string;
  /** Rows shown before the grid scrolls inside itself. */
  height?: number;
}) {
  return (
    <div role="region" aria-label={props.label} style={{ height: props.height ?? 440 }} className="w-full min-w-0">
      <AgGridReact<T>
        theme={theme}
        rowData={props.rows}
        columnDefs={props.columns}
        defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 }}
        getRowId={props.getRowId ? (p) => props.getRowId!(p.data) : undefined}
        overlayNoRowsTemplate="<span>Nothing here yet.</span>"
        suppressCellFocus={false}
        enableCellTextSelection
        // Small tables: every column stays in the page, so screen readers (and phones) get all of it.
        suppressColumnVirtualisation
      />
    </div>
  );
}
