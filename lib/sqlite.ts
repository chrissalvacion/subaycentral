import Database from "better-sqlite3";
import path from "path";

type Primitive = string | number | null;

type Filter =
  | { op: "eq"; column: string; value: Primitive }
  | { op: "in"; column: string; values: Primitive[] }
  | { op: "gte"; column: string; value: Primitive }
  | { op: "lte"; column: string; value: Primitive };

const dbPath = path.join(process.cwd(), "dev.sqlite");
const db = new Database(dbPath);

let initialized = false;

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  // Lightweight UUID generator for development only
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      program TEXT,
      section TEXT,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'intern',
      student_id TEXT,
      duty_hours_per_day REAL DEFAULT 8,
      avatar_url TEXT,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      required_hours INTEGER NOT NULL DEFAULT 600,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      contact_person TEXT,
      contact_number TEXT,
      email TEXT,
      intern_slot_limit INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      program_id TEXT,
      school_year TEXT,
      semester TEXT,
      start_date TEXT,
      end_date TEXT,
      required_hours INTEGER NOT NULL DEFAULT 600,
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployment_faculty (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      faculty_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(deployment_id, faculty_id)
    );

    CREATE TABLE IF NOT EXISTS intern_deployments (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      deployment_id TEXT NOT NULL,
      agency_id TEXT,
      start_date TEXT,
      expected_end_date TEXT,
      required_hours INTEGER,
      rendered_hours REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(intern_id, deployment_id)
    );

    CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      intern_deployment_id TEXT NOT NULL,
      date TEXT NOT NULL,
      tasks TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(intern_id, date)
    );

    CREATE TABLE IF NOT EXISTS time_records (
      id TEXT PRIMARY KEY,
      intern_id TEXT NOT NULL,
      intern_deployment_id TEXT NOT NULL,
      date TEXT NOT NULL,
      morning_time_in TEXT,
      morning_time_out TEXT,
      afternoon_time_in TEXT,
      afternoon_time_out TEXT,
      time_in TEXT,
      time_out TEXT,
      total_hours REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(intern_id, date)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      faculty_id TEXT,
      intern_id TEXT NOT NULL,
      intern_deployment_id TEXT NOT NULL,
      content TEXT NOT NULL,
      performance_rating INTEGER,
      reaction TEXT,
      intern_read_at DATETIME,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function ensureProfileColumns() {
  const profileColumns = db
    .prepare("PRAGMA table_info(profiles)")
    .all() as { name: string }[];

  const existing = new Set(profileColumns.map((column) => column.name));
  const missingColumns: Array<{ name: string; type: string }> = [
    { name: "first_name", type: "TEXT" },
    { name: "middle_name", type: "TEXT" },
    { name: "last_name", type: "TEXT" },
    { name: "program", type: "TEXT" },
    { name: "section", type: "TEXT" },
    { name: "duty_hours_per_day", type: "REAL DEFAULT 8" },
  ].filter((column) => !existing.has(column.name));

  for (const column of missingColumns) {
    db.exec(`ALTER TABLE profiles ADD COLUMN ${column.name} ${column.type}`);
  }
}

function ensurePartnerAgencyColumns() {
  const agencyColumns = db
    .prepare("PRAGMA table_info(partner_agencies)")
    .all() as { name: string }[];

  const existing = new Set(agencyColumns.map((column) => column.name));
  if (!existing.has("intern_slot_limit")) {
    db.exec("ALTER TABLE partner_agencies ADD COLUMN intern_slot_limit INTEGER");
  }
}

function ensureFeedbackColumns() {
  const feedbackColumns = db
    .prepare("PRAGMA table_info(feedback)")
    .all() as { name: string }[];

  const existing = new Set(feedbackColumns.map((column) => column.name));
  if (!existing.has("reaction")) {
    db.exec("ALTER TABLE feedback ADD COLUMN reaction TEXT");
  }
  if (!existing.has("intern_read_at")) {
    db.exec("ALTER TABLE feedback ADD COLUMN intern_read_at DATETIME");
  }
}

function ensureTimeRecordColumns() {
  const timeRecordColumns = db
    .prepare("PRAGMA table_info(time_records)")
    .all() as { name: string }[];

  const existing = new Set(timeRecordColumns.map((column) => column.name));
  const missingColumns: Array<{ name: string; type: string }> = [
    { name: "morning_time_in", type: "TEXT" },
    { name: "morning_time_out", type: "TEXT" },
    { name: "afternoon_time_in", type: "TEXT" },
    { name: "afternoon_time_out", type: "TEXT" },
  ].filter((column) => !existing.has(column.name));

  for (const column of missingColumns) {
    db.exec(`ALTER TABLE time_records ADD COLUMN ${column.name} ${column.type}`);
  }
}

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as c FROM profiles").get() as { c: number };
  if (count.c > 0) return;

  const now = nowIso();
  const adminId = uuid();
  const facultyId = uuid();
  const internId = uuid();
  const programId = uuid();
  const agencyId = uuid();
  const deploymentId = uuid();
  const internDeploymentId = uuid();

  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, full_name, email, phone, role, student_id, avatar_url, password, created_at, updated_at)
    VALUES (@id, @full_name, @email, @phone, @role, @student_id, @avatar_url, @password, @created_at, @updated_at)
  `);

  insertProfile.run({
    id: adminId,
    full_name: "Admin User",
    email: "admin@subaycentral.local",
    phone: "09170000001",
    role: "admin",
    student_id: null,
    avatar_url: null,
    password: "password123",
    created_at: now,
    updated_at: now,
  });

  insertProfile.run({
    id: facultyId,
    full_name: "Faculty Adviser",
    email: "faculty@subaycentral.local",
    phone: "09170000002",
    role: "faculty",
    student_id: null,
    avatar_url: null,
    password: "password123",
    created_at: now,
    updated_at: now,
  });

  insertProfile.run({
    id: internId,
    full_name: "Juan Dela Cruz",
    email: "intern@subaycentral.local",
    phone: "09170000003",
    role: "intern",
    student_id: "2025-0001",
    avatar_url: null,
    password: "password123",
    created_at: now,
    updated_at: now,
  });

  db.prepare(`
    INSERT INTO programs (id, name, description, required_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(programId, "BS Information Technology", "Default seeded program", 600, now, now);

  db.prepare(`
    INSERT INTO partner_agencies (id, name, address, contact_person, contact_number, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agencyId,
    "City ICT Office",
    "City Hall Complex",
    "Ms. Santos",
    "(02) 8000-1000",
    "ictoffice@example.com",
    now,
    now
  );

  db.prepare(`
    INSERT INTO deployments (id, name, description, program_id, school_year, semester, start_date, end_date, required_hours, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deploymentId,
    "OJT Batch A",
    "Seeded deployment",
    programId,
    "2025-2026",
    "2nd Semester",
    "2026-01-15",
    "2026-05-30",
    600,
    "active",
    now,
    now
  );

  db.prepare(`
    INSERT INTO deployment_faculty (id, deployment_id, faculty_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), deploymentId, facultyId, now);

  db.prepare(`
    INSERT INTO intern_deployments (id, intern_id, deployment_id, agency_id, start_date, expected_end_date, required_hours, rendered_hours, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    internDeploymentId,
    internId,
    deploymentId,
    agencyId,
    "2026-01-15",
    "2026-05-30",
    600,
    32,
    "active",
    now,
    now
  );
}

export function ensureDevDb() {
  if (initialized) return;
  createTables();
  ensureProfileColumns();
  ensurePartnerAgencyColumns();
  ensureFeedbackColumns();
  ensureTimeRecordColumns();
  seedIfEmpty();
  initialized = true;
}

export function findProfileByEmailPassword(email: string, password: string) {
  ensureDevDb();
  return db
    .prepare("SELECT * FROM profiles WHERE email = ? AND password = ? LIMIT 1")
    .get(email, password) as Record<string, unknown> | undefined;
}

export function updateProfilePassword(id: string, password: string) {
  ensureDevDb();
  db.prepare("UPDATE profiles SET password = ?, updated_at = ? WHERE id = ?").run(password, nowIso(), id);
}

function buildWhere(filters: Filter[]) {
  if (!filters.length) return { whereSql: "", params: [] as Primitive[] };
  const clauses: string[] = [];
  const params: Primitive[] = [];
  for (const f of filters) {
    if (f.op === "eq") {
      clauses.push(`${f.column} = ?`);
      params.push(f.value);
    }
    if (f.op === "in") {
      const placeholders = f.values.map(() => "?").join(", ");
      clauses.push(`${f.column} IN (${placeholders})`);
      params.push(...f.values);
    }
    if (f.op === "gte") {
      clauses.push(`${f.column} >= ?`);
      params.push(f.value);
    }
    if (f.op === "lte") {
      clauses.push(`${f.column} <= ?`);
      params.push(f.value);
    }
  }
  return { whereSql: ` WHERE ${clauses.join(" AND ")}`, params };
}

function hydrateRows(table: string, selectText: string | undefined, rows: Record<string, unknown>[]) {
  if (!selectText) return rows;

  if (table === "intern_deployments") {
    const includeProfiles = selectText.includes("profiles(");
    const includeDeployments = selectText.includes("deployments(");
    const includeAgencies = selectText.includes("partner_agencies(");

    const getProfile = db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1");
    const getDeployment = db.prepare("SELECT * FROM deployments WHERE id = ? LIMIT 1");
    const getAgency = db.prepare("SELECT * FROM partner_agencies WHERE id = ? LIMIT 1");

    return rows.map((row) => {
      const next = { ...row } as Record<string, unknown>;
      if (includeProfiles && row.intern_id) {
        next.profiles = getProfile.get(row.intern_id as string) ?? null;
      }
      if (includeDeployments && row.deployment_id) {
        next.deployments = getDeployment.get(row.deployment_id as string) ?? null;
      }
      if (includeAgencies && row.agency_id) {
        next.partner_agencies = getAgency.get(row.agency_id as string) ?? null;
      }
      return next;
    });
  }

  if (table === "deployments") {
    const includePrograms = selectText.includes("programs(");
    const includeDeploymentFaculty = selectText.includes("deployment_faculty(");
    const includeProfiles = selectText.includes("profiles(");

    const getProgram = db.prepare("SELECT * FROM programs WHERE id = ? LIMIT 1");
    const getDepFaculty = db.prepare(
      "SELECT * FROM deployment_faculty WHERE deployment_id = ? ORDER BY created_at DESC"
    );
    const getProfile = db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1");

    return rows.map((row) => {
      const next = { ...row } as Record<string, unknown>;
      if (includePrograms && row.program_id) {
        next.programs = getProgram.get(row.program_id as string) ?? null;
      }
      if (includeDeploymentFaculty && row.id) {
        const depFac = getDepFaculty.all(row.id as string) as Record<string, unknown>[];
        next.deployment_faculty = depFac.map((df) => {
          if (includeProfiles && df.faculty_id) {
            return { ...df, profiles: getProfile.get(df.faculty_id as string) ?? null };
          }
          return df;
        });
      }
      return next;
    });
  }

  if (table === "feedback" && selectText.includes("profiles")) {
    const getProfile = db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1");
    return rows.map((row) => ({
      ...row,
      profiles: row.faculty_id ? getProfile.get(row.faculty_id as string) ?? null : null,
    }));
  }

  return rows;
}

export function queryTable(input: {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  selectText?: string;
  head?: boolean;
  countExact?: boolean;
  single?: boolean;
  filters: Filter[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  values?: Record<string, unknown> | Record<string, unknown>[];
}) {
  ensureDevDb();

  const { table, action, filters } = input;
  const { whereSql, params } = buildWhere(filters);

  if (action === "select") {
    const orderSql = input.orderBy
      ? ` ORDER BY ${input.orderBy.column} ${input.orderBy.ascending ? "ASC" : "DESC"}`
      : "";
    const limitSql = input.limit ? ` LIMIT ${input.limit}` : "";

    if (input.head && input.countExact) {
      const countRow = db
        .prepare(`SELECT COUNT(*) as c FROM ${table}${whereSql}`)
        .get(...params) as { c: number };
      return { data: null, count: countRow.c, error: null };
    }

    const rows = db
      .prepare(`SELECT * FROM ${table}${whereSql}${orderSql}${limitSql}`)
      .all(...params) as Record<string, unknown>[];

    const hydrated = hydrateRows(table, input.selectText, rows);

    if (input.single) {
      return {
        data: hydrated[0] ?? null,
        count: null,
        error: hydrated[0] ? null : { message: "No rows found" },
      };
    }

    return { data: hydrated, count: null, error: null };
  }

  if (action === "insert") {
    const rows = Array.isArray(input.values) ? input.values : [input.values ?? {}];
    const inserted: Record<string, unknown>[] = [];

    for (const row of rows) {
      const now = nowIso();
      const withDefaults = {
        id: (row.id as string | undefined) ?? uuid(),
        created_at: (row.created_at as string | undefined) ?? now,
        updated_at: (row.updated_at as string | undefined) ?? now,
        ...row,
      };
      const columns = Object.keys(withDefaults);
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((c) => (withDefaults as Record<string, unknown>)[c]);
      db.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
      ).run(...values);
      inserted.push(withDefaults);
    }

    return { data: inserted, count: null, error: null };
  }

  if (action === "update") {
    const values = (input.values ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = { ...values, updated_at: nowIso() };
    const setCols = Object.keys(set);
    const setSql = setCols.map((c) => `${c} = ?`).join(", ");
    const setValues = setCols.map((c) => set[c]);
    db.prepare(`UPDATE ${table} SET ${setSql}${whereSql}`).run(...setValues, ...params);

    const rows = db
      .prepare(`SELECT * FROM ${table}${whereSql}`)
      .all(...params) as Record<string, unknown>[];
    return { data: rows, count: null, error: null };
  }

  if (action === "delete") {
    db.prepare(`DELETE FROM ${table}${whereSql}`).run(...params);
    return { data: [], count: null, error: null };
  }

  return { data: null, count: null, error: { message: "Unsupported action" } };
}

export function createProfile(input: {
  full_name: string;
  email: string;
  password: string;
  role: "faculty" | "intern";
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  program?: string;
  section?: string;
  phone?: string;
  student_id?: string;
}) {
  ensureDevDb();
  const id = uuid();
  const now = nowIso();
  db.prepare(`
    INSERT INTO profiles (id, full_name, first_name, middle_name, last_name, program, section, email, phone, role, student_id, avatar_url, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(
    id,
    input.full_name,
    input.first_name ?? null,
    input.middle_name ?? null,
    input.last_name ?? null,
    input.program ?? null,
    input.section ?? null,
    input.email,
    input.phone ?? null,
    input.role,
    input.student_id ?? null,
    input.password,
    now,
    now
  );
  return db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").get(id) as Record<string, unknown>;
}

export function updateProfile(
  id: string,
  data: {
    full_name?: string;
    email?: string;
    role?: "faculty" | "intern";
    phone?: string;
    student_id?: string | null;
    program?: string | null;
    section?: string | null;
  }
) {
  ensureDevDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (data.full_name !== undefined) {
    fields.push("full_name = ?");
    vals.push(data.full_name);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    vals.push(data.email);
  }
  if (data.role !== undefined) {
    fields.push("role = ?");
    vals.push(data.role);
  }
  if (data.phone !== undefined) {
    fields.push("phone = ?");
    vals.push(data.phone);
  }
  if (data.student_id !== undefined) {
    fields.push("student_id = ?");
    vals.push(data.student_id);
  }
  if (data.program !== undefined) {
    fields.push("program = ?");
    vals.push(data.program);
  }
  if (data.section !== undefined) {
    fields.push("section = ?");
    vals.push(data.section);
  }
  fields.push("updated_at = ?");
  vals.push(nowIso());
  vals.push(id);
  db.prepare(`UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteProfile(id: string) {
  ensureDevDb();
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}
