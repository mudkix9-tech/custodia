import { describe, test, expect } from 'vitest';
import { parseCsv, toCsvRow } from '../csv';
import { parseRopaCsv } from '../ropaImport';

describe('parseCsv', () => {
  test('keeps a comma inside a quoted field in that field', () => {
    // The bug the previous importer had: this row split into 4 columns, shifting
    // lawful basis into status and status into risk level.
    const [row] = parseCsv('"Billing, invoicing and collections","Contract","active"');
    expect(row).toEqual(['Billing, invoicing and collections', 'Contract', 'active']);
  });

  test('unescapes doubled quotes', () => {
    const [row] = parseCsv('"She said ""no""","b"');
    expect(row).toEqual(['She said "no"', 'b']);
  });

  test('keeps a newline inside a quoted field', () => {
    const rows = parseCsv('"line one\nline two",b\nc,d');
    expect(rows).toEqual([['line one\nline two', 'b'], ['c', 'd']]);
  });

  test('handles CRLF, a trailing newline and a BOM', () => {
    expect(parseCsv('﻿a,b\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  test('round-trips whatever the exporter writes', () => {
    const values = ['Billing, "core"', 'multi\nline', ''];
    expect(parseCsv(toCsvRow(values))[0]).toEqual(values);
  });
});

describe('parseRopaCsv', () => {
  const header = 'Name,Purpose,Lawful Basis,Status,Risk Level,Description';

  test('imports a well-formed row', () => {
    const { activities, errors } = parseRopaCsv(`${header}\n"Payroll","Pay staff","contract","active","low","x"`);
    expect(errors).toEqual([]);
    expect(activities).toEqual([
      {
        name: 'Payroll', purpose: 'Pay staff', lawfulBasis: 'contract',
        status: 'active', riskLevel: 'low', description: 'x',
        role: 'controller', controllerName: undefined,
      },
    ]);
  });

  test('does not shift columns when a field contains a comma', () => {
    const { activities } = parseRopaCsv(
      `${header}\n"Billing","Billing, invoicing and collections","legitimate_interest","active","medium",""`,
    );
    expect(activities[0].lawfulBasis).toBe('legitimate_interest');
    expect(activities[0].status).toBe('active');
  });

  test('rejects a row with no lawful basis rather than defaulting it', () => {
    const { activities, errors } = parseRopaCsv(`${header}\n"Payroll","Pay staff","","active","low",""`);
    expect(activities).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].message).toContain('lawful basis');
  });

  test('rejects an unrecognised lawful basis', () => {
    const { activities, errors } = parseRopaCsv(`${header}\n"Payroll","Pay staff","because we can","active","low",""`);
    expect(activities).toHaveLength(0);
    expect(errors[0].message).toContain('unrecognised lawful basis');
  });

  test('accepts human spellings of the enums', () => {
    const { activities, errors } = parseRopaCsv(
      `${header}\n"Payroll","Pay staff","Legitimate Interests","Under Review","High",""`,
    );
    expect(errors).toEqual([]);
    expect(activities[0]).toMatchObject({
      lawfulBasis: 'legitimate_interest',
      status: 'under_review',
      riskLevel: 'high',
    });
  });

  test('reports good and bad rows separately, with line numbers', () => {
    const { activities, errors } = parseRopaCsv(
      `${header}\n"A","Purpose A","consent","active","low",""\n"B","Purpose B","","active","low",""`,
    );
    expect(activities.map((a) => a.name)).toEqual(['A']);
    expect(errors.map((e) => e.line)).toEqual([3]);
  });

  test('maps columns by header, so a reordered export still imports', () => {
    const { activities, errors } = parseRopaCsv('Purpose,Lawful Basis,Name\n"Pay staff","consent","Payroll"');
    expect(errors).toEqual([]);
    expect(activities[0]).toMatchObject({ name: 'Payroll', purpose: 'Pay staff', lawfulBasis: 'consent' });
  });

  test('fails the whole file when a required column is absent', () => {
    const { fatal } = parseRopaCsv('Name,Purpose\n"Payroll","Pay staff"');
    expect(fatal).toContain('lawful basis');
  });

  test('defaults role to controller when the file has no role column', () => {
    const { activities } = parseRopaCsv('Name,Purpose,Lawful Basis\n"Payroll","Pay staff","consent"');
    expect(activities[0].role).toBe('controller');
    expect(activities[0].controllerName).toBeUndefined();
  });

  test('reads a processor row with its controller', () => {
    const { activities, errors } = parseRopaCsv(
      'Name,Purpose,Lawful Basis,Role,Controller\n"Hosting","Host CRM data","contract","Processor","Acme GmbH"',
    );
    expect(errors).toEqual([]);
    expect(activities[0]).toMatchObject({ role: 'processor', controllerName: 'Acme GmbH' });
  });

  test('rejects a processor row that names no controller', () => {
    // Article 30(2)(a) requires the controller a processor acts for.
    const { activities, errors } = parseRopaCsv(
      'Name,Purpose,Lawful Basis,Role\n"Hosting","Host CRM data","contract","processor"',
    );
    expect(activities).toHaveLength(0);
    expect(errors[0].message).toContain('Article 30(2)(a)');
  });

  test('accepts joint controller', () => {
    const { activities, errors } = parseRopaCsv(
      'Name,Purpose,Lawful Basis,Role\n"Ads","Joint campaign","consent","Joint Controller"',
    );
    expect(errors).toEqual([]);
    expect(activities[0].role).toBe('joint_controller');
  });

  test('rejects an unrecognised role', () => {
    const { errors } = parseRopaCsv(
      'Name,Purpose,Lawful Basis,Role\n"Ads","Campaign","consent","subprocessor"',
    );
    expect(errors[0].message).toContain('unrecognised role');
  });

  test('defaults only the low-stakes columns', () => {
    const { activities } = parseRopaCsv('Name,Purpose,Lawful Basis\n"Payroll","Pay staff","consent"');
    expect(activities[0]).toMatchObject({ status: 'draft', riskLevel: 'low' });
  });
});
