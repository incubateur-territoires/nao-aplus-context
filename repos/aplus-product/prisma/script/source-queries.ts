import { getSourcePool } from "./source-db";

// ============================================
// Helper
// ============================================
function cleanIdentifier(value: string): string {
  return value.replace(/[\s.]/g, "");
}

// ============================================
// AREAS (table: area)
// ============================================
export async function fetchAreas(): Promise<
  Array<{ id: string; name: string; inseeCode: string }>
> {
  const pool = getSourcePool();
  const { rows } = await pool.query(
    `SELECT id, name, insee_code AS "inseeCode" FROM area ORDER BY id`,
  );
  return rows;
}

// ============================================
// ORGANIZATIONS (table: organisation)
// ============================================
export async function fetchOrganizations(): Promise<
  Array<{ id_v1: string; shortName: string; name: string }>
> {
  const pool = getSourcePool();
  const { rows } = await pool.query(
    `SELECT id AS id_v1, short_name AS "shortName", name
     FROM organisation ORDER BY id`,
  );
  return rows;
}

// ============================================
// USERS (table: user_table)
// ============================================
export interface UserRow {
  id: string;
  name: string;
  qualite: string;
  email: string;
  admin: boolean;
  areas: string[];
  creation_date: Date | null;
  group_admin: boolean;
  group_ids: string[];
  cgu_acceptation_date: Date | null;
  newsletter_acceptation_date: Date | null;
  disabled: boolean;
  phone_number: string;
  first_name: string;
  last_name: string;
  internal_support_comment: string;
  first_login_date: Date | null;
  password_activated: boolean;
}

export async function fetchUsers(since?: Date): Promise<UserRow[]> {
  const pool = getSourcePool();

  let query = `
    SELECT id, name, qualite, email, admin, areas, creation_date,
           group_admin, group_ids, cgu_acceptation_date,
           newsletter_acceptation_date, disabled, phone_number,
           first_name, last_name, internal_support_comment,
           first_login_date, password_activated
    FROM "user"`;

  const params: unknown[] = [];
  if (since) {
    query += ` WHERE creation_date >= $1`;
    params.push(since);
  }
  query += ` ORDER BY creation_date`;

  const { rows } = await pool.query(query, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: (r.id as string) ?? "",
    name: (r.name as string) ?? "",
    qualite: (r.qualite as string) ?? "",
    email: (r.email as string) ?? "",
    admin: (r.admin as boolean) ?? false,
    areas: (r.areas as string[]) ?? [],
    creation_date: (r.creation_date as Date) ?? null,
    group_admin: (r.group_admin as boolean) ?? false,
    group_ids: (r.group_ids as string[]) ?? [],
    cgu_acceptation_date: (r.cgu_acceptation_date as Date) ?? null,
    newsletter_acceptation_date:
      (r.newsletter_acceptation_date as Date) ?? null,
    disabled: (r.disabled as boolean) ?? false,
    phone_number: (r.phone_number as string) ?? "",
    first_name: (r.first_name as string) ?? "",
    last_name: (r.last_name as string) ?? "",
    internal_support_comment: (r.internal_support_comment as string) ?? "",
    first_login_date: (r.first_login_date as Date) ?? null,
    password_activated: (r.password_activated as boolean) ?? false,
  }));
}

// ============================================
// USER SESSIONS (table: user_session)
// ============================================
export async function fetchUserSessions(): Promise<Map<string, Date>> {
  const pool = getSourcePool();
  const { rows } = await pool.query(
    `SELECT user_id, last_activity FROM user_session`,
  );
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.user_id && row.last_activity) {
      map.set(row.user_id, new Date(row.last_activity));
    }
  }
  return map;
}

// ============================================
// PASSWORDS (table: password)
// ============================================
export async function fetchPasswords(
  userIds?: string[],
): Promise<Map<string, string>> {
  const pool = getSourcePool();

  let query = `SELECT user_id, password_hash FROM password`;
  const params: unknown[] = [];
  if (userIds && userIds.length > 0) {
    query += ` WHERE user_id = ANY($1)`;
    params.push(userIds);
  }

  const { rows } = await pool.query(query, params);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.user_id && row.password_hash) {
      map.set(row.user_id, row.password_hash);
    }
  }
  return map;
}

// ============================================
// TEAMS (table: user_group)
// ============================================
export interface TeamRow {
  id: string;
  name: string;
  creation_date: Date | null;
  organisation: string;
  email: string;
  description: string;
  area_ids: string[];
  public_note: string;
  internal_support_comment: string;
  is_in_france_services_network: boolean;
  registration_number: string | null;
}

export async function fetchTeams(since?: Date): Promise<TeamRow[]> {
  const pool = getSourcePool();

  let query = `
    SELECT DISTINCT ON (ug.id)
           ug.id, ug.name, ug.creation_date, ug.area AS single_area,
           ug.organisation, ug.email, ug.description, ug.area_ids,
           ug.public_note, ug.internal_support_comment,
           COALESCE(ug.is_in_france_services_network, false) AS is_in_france_services_network,
           fs.matricule AS registration_number
    FROM user_group ug
    LEFT JOIN france_service fs ON fs.group_id = ug.id`;

  const params: unknown[] = [];
  if (since) {
    query += ` WHERE ug.creation_date >= $1`;
    params.push(since);
  }
  query += ` ORDER BY ug.id, ug.creation_date`;

  const { rows } = await pool.query(query, params);
  return rows.map((r: Record<string, unknown>) => {
    // Combine area_ids array + single area, deduplicated
    const areaIds = (r.area_ids as string[]) ?? [];
    const singleArea = r.single_area as string | null;
    if (singleArea && !areaIds.includes(singleArea)) {
      areaIds.push(singleArea);
    }

    return {
      id: (r.id as string) ?? "",
      name: (r.name as string) ?? "",
      creation_date: (r.creation_date as Date) ?? null,
      organisation: (r.organisation as string) ?? "",
      email: (r.email as string) ?? "",
      description: (r.description as string) ?? "",
      area_ids: areaIds,
      public_note: (r.public_note as string) ?? "",
      internal_support_comment: (r.internal_support_comment as string) ?? "",
      is_in_france_services_network:
        (r.is_in_france_services_network as boolean) ?? false,
      registration_number: (r.registration_number as string) ?? null,
    };
  });
}

// ============================================
// REPORTS (table: application)
// ============================================
export interface UserInfos {
  firstName: string;
  lastName: string;
  birthDate: string;
  nir: string;
  nif: string;
  caf: string;
  phone: string;
}

export interface ReportRow {
  id: string;
  creation_date: Date | null;
  creator_user_id: string;
  subject: string;
  description: string;
  user_infos: UserInfos;
  invited_users: string[];
  area: string;
  closed: boolean;
  closed_date: Date | null;
  invited_group_ids: string[];
  creator_group_id: string;
}

/** Convert DD/MM/YYYY to YYYY-MM-DD (ISO). Returns as-is if not matching. */
function normalizeBirthDate(value: string): string {
  if (!value) return "";
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return value;
}

function mapUserInfos(raw: Record<string, string> | null): UserInfos {
  if (!raw) {
    return {
      firstName: "",
      lastName: "",
      birthDate: "",
      nir: "",
      nif: "",
      caf: "",
      phone: "",
    };
  }
  return {
    firstName: raw["Prénom"] ?? "",
    lastName: raw["Nom de famille"] ?? "",
    birthDate: normalizeBirthDate(raw["Date de naissance"] ?? ""),
    nir: cleanIdentifier(raw["Numéro de sécurité sociale"] ?? ""),
    nif: cleanIdentifier(raw["Numéro fiscal"] ?? ""),
    caf: cleanIdentifier(raw["Identifiant CAF"] ?? ""),
    phone: cleanIdentifier(raw["Numéro de téléphone"] ?? ""),
  };
}

export async function fetchReports(since?: Date): Promise<ReportRow[]> {
  const pool = getSourcePool();

  let query: string;
  const params: unknown[] = [];

  if (since) {
    // Delta: reports created since OR having answers created since
    query = `
      SELECT DISTINCT r.id, r.creation_date, r.creator_user_id, r.subject,
             r.description, r.user_infos, r.invited_users, r.area,
             r.closed, r.closed_date, r.invited_group_ids, r.creator_group_id
      FROM application r
      LEFT JOIN answer a ON a.application_id = r.id
      WHERE r.creation_date >= $1 OR a.creation_date >= $1
      ORDER BY r.creation_date`;
    params.push(since);
  } else {
    query = `
      SELECT id, creation_date, creator_user_id, subject,
             description, user_infos, invited_users, area,
             closed, closed_date, invited_group_ids, creator_group_id
      FROM application
      ORDER BY creation_date`;
  }

  const { rows } = await pool.query(query, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: (r.id as string) ?? "",
    creation_date: (r.creation_date as Date) ?? null,
    creator_user_id: (r.creator_user_id as string) ?? "",
    subject: (r.subject as string) ?? "",
    description: (r.description as string) ?? "",
    user_infos: mapUserInfos(r.user_infos as Record<string, string> | null),
    invited_users: r.invited_users
      ? Object.keys(r.invited_users as Record<string, unknown>)
      : [],
    area: (r.area as string) ?? "",
    closed: (r.closed as boolean) ?? false,
    closed_date: (r.closed_date as Date) ?? null,
    invited_group_ids: (r.invited_group_ids as string[]) ?? [],
    creator_group_id: (r.creator_group_id as string) ?? "",
  }));
}

// ============================================
// ANSWERS (table: answer)
// ============================================
export interface AnswerRow {
  id: string;
  application_id: string;
  answer_order: number;
  creation_date: Date | null;
  answer_type: string;
  message: string;
  creator_user_id: string;
  visible_by_helpers: boolean;
  declare_application_is_irrelevant: boolean;
  invited_users: string[];
  invited_group_ids: string[];
}

// ============================================
// FILES (table: file_metadata)
// ============================================
export interface FileRow {
  id: string;
  upload_date: Date | null;
  filename: string;
  filesize: number;
  status: string;
  application_id: string;
  answer_id: string | null;
  encryption_key_id: string;
}

export async function fetchFiles(
  applicationIds?: string[],
  sinceDate?: Date,
): Promise<FileRow[]> {
  const pool = getSourcePool();

  let query = `
    SELECT id, upload_date, filename, filesize, status,
           application_id, answer_id, encryption_key_id
    FROM file_metadata
    WHERE status = 'available'`;

  const params: unknown[] = [];
  let paramIndex = 1;
  if (applicationIds && applicationIds.length > 0) {
    query += ` AND application_id = ANY($${paramIndex})`;
    params.push(applicationIds);
    paramIndex++;
  }
  if (sinceDate) {
    query += ` AND upload_date >= $${paramIndex}`;
    params.push(sinceDate);
    paramIndex++;
  }
  query += ` ORDER BY upload_date`;

  const { rows } = await pool.query(query, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: (r.id as string) ?? "",
    upload_date: (r.upload_date as Date) ?? null,
    filename: (r.filename as string) ?? "",
    filesize: (r.filesize as number) ?? 0,
    status: (r.status as string) ?? "",
    application_id: (r.application_id as string) ?? "",
    answer_id: (r.answer_id as string | null) ?? null,
    encryption_key_id: (r.encryption_key_id as string) ?? "",
  }));
}

export async function fetchAnswers(reportIds?: string[]): Promise<AnswerRow[]> {
  const pool = getSourcePool();

  let query = `
    SELECT id, application_id, answer_order, creation_date, answer_type,
           message, creator_user_id, invited_users, invited_group_ids,
           visible_by_helpers, declare_application_is_irrelevant
    FROM answer`;

  const params: unknown[] = [];
  if (reportIds && reportIds.length > 0) {
    query += ` WHERE application_id = ANY($1)`;
    params.push(reportIds);
  }
  query += ` ORDER BY application_id, answer_order`;

  const { rows } = await pool.query(query, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: (r.id as string) ?? "",
    application_id: (r.application_id as string) ?? "",
    answer_order: (r.answer_order as number) ?? 0,
    creation_date: (r.creation_date as Date) ?? null,
    answer_type: (r.answer_type as string) ?? "",
    message: (r.message as string) ?? "",
    creator_user_id: (r.creator_user_id as string) ?? "",
    visible_by_helpers: (r.visible_by_helpers as boolean) ?? true,
    declare_application_is_irrelevant:
      (r.declare_application_is_irrelevant as boolean) ?? false,
    invited_users: r.invited_users
      ? Object.keys(r.invited_users as Record<string, unknown>)
      : [],
    invited_group_ids: (r.invited_group_ids as string[]) ?? [],
  }));
}
