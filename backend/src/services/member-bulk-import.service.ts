import * as XLSX from "xlsx";
import UserProfile, { SPIRITUAL_GROWTH_STAGES } from "../models/user-profile.model";
import Role from "../models/role.model";
import { AppError } from "./app-error";
import { emitRealtimeInvalidation } from "../realtime/socket";

const MEMBER_QUERY_KEYS = [["members"], ["myCourses"], ["myAttendance"], ["courseAssignments"]];

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza (Niñas entre 7 y 14 años)",
  "Ministerio de Jóvenes",
  "Ministerio de Servidores",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Hombres",
  "Ministerio de Mujeres",
  "Ministerio de Parejas y Familias",
  "Ministerio Iglesia Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E",
];

const ENCOUNTER_STAGES = ["Ninguno", "Encuentro", "Reencuentro"];

interface BulkImportErrorItem {
  row: number;
  documentID: string | null;
  firstName?: string | null;
  reason: string;
}

interface BulkImportInsertedItem {
  row: number;
  documentID: string;
  firstName: string;
  lastName: string;
}

export interface BulkImportResult {
  total: number;
  insertedCount: number;
  failedCount: number;
  inserted: BulkImportInsertedItem[];
  errors: BulkImportErrorItem[];
}

type HeaderKey =
  | "firstName"
  | "lastName"
  | "documentID"
  | "birthdate"
  | "neighborhood"
  | "phoneNumber"
  | "bloodType"
  | "servesInMinistry"
  | "ministry"
  | "ministryInterest"
  | "spiritualGrowthStage"
  | "encounterStage";

const HEADER_MAP: Record<string, HeaderKey> = {
  nombre: "firstName",
  apellidos: "lastName",
  documento: "documentID",
  "fecha de nacimiento": "birthdate",
  barrio: "neighborhood",
  telefono: "phoneNumber",
  "tipo de sangre": "bloodType",
  "sirve en un ministerio": "servesInMinistry",
  "ministerio en el que sirve": "ministry",
  "ministerio de interes": "ministryInterest",
  "ruta de crecimiento espiritual": "spiritualGrowthStage",
  "encuentro y reencuentro": "encounterStage",
};

const REQUIRED_HEADERS = Object.keys(HEADER_MAP);

interface ParsedCandidate {
  row: number;
  firstName: string;
  lastName: string;
  documentID: string;
  birthdate: Date;
  neighborhood: string;
  phoneNumber: string;
  bloodType: string;
  servesInMinistry: boolean;
  ministry?: string;
  ministryInterest?: string;
  spiritualGrowthStage: string;
  encounterStage: string;
}

const normalizeHeader = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const normalizeString = (value: unknown): string =>
  String(value ?? "").trim();

const parseBooleanCell = (value: unknown): boolean | null => {
  const normalized = normalizeString(value).toLowerCase();
  if (["si", "sí", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
};

const parseDateCell = (value: unknown): Date | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.exec(normalized);
  if (isoMatch) {
    const [year, month, day] = normalized.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const latinMatch = /^\d{2}\/\d{2}\/\d{4}$/.exec(normalized);
  if (latinMatch) {
    const [day, month, year] = normalized.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  return null;
};

const validateDocumentID = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized) || normalized.length < 6 || normalized.length > 10) {
    return null;
  }
  return normalized;
};

const validatePhoneNumber = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!/^\d{10}$/.test(normalized)) return null;
  return normalized;
};

const buildHeaderIndex = (headerRow: unknown[]): Map<HeaderKey, number> => {
  const indexByKey = new Map<HeaderKey, number>();
  const seenHeaders = new Set<string>();

  headerRow.forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!header || seenHeaders.has(header)) return;
    seenHeaders.add(header);

    const key = HEADER_MAP[header];
    if (key && !indexByKey.has(key)) {
      indexByKey.set(key, index);
    }
  });

  return indexByKey;
};

const getCellValue = (row: unknown[], indexByKey: Map<HeaderKey, number>, key: HeaderKey): unknown => {
  const index = indexByKey.get(key);
  if (index === undefined) return "";
  return row[index];
};

const validateRow = (
  row: unknown[],
  rowNumber: number,
  indexByKey: Map<HeaderKey, number>,
): ParsedCandidate | BulkImportErrorItem => {
  const firstName = normalizeString(getCellValue(row, indexByKey, "firstName"));
  const lastName = normalizeString(getCellValue(row, indexByKey, "lastName"));
  const rawDocumentID = getCellValue(row, indexByKey, "documentID");
  const rawBirthdate = getCellValue(row, indexByKey, "birthdate");
  const neighborhood = normalizeString(getCellValue(row, indexByKey, "neighborhood"));
  const rawPhoneNumber = getCellValue(row, indexByKey, "phoneNumber");
  const rawBloodType = normalizeString(getCellValue(row, indexByKey, "bloodType"));
  const rawServesInMinistry = getCellValue(row, indexByKey, "servesInMinistry");
  const rawMinistry = normalizeString(getCellValue(row, indexByKey, "ministry"));
  const rawMinistryInterest = normalizeString(getCellValue(row, indexByKey, "ministryInterest"));
  const rawSpiritualGrowthStage = normalizeString(
    getCellValue(row, indexByKey, "spiritualGrowthStage"),
  );
  const rawEncounterStage = normalizeString(getCellValue(row, indexByKey, "encounterStage"));

  const documentID = validateDocumentID(rawDocumentID);
  const birthdate = parseDateCell(rawBirthdate);
  const phoneNumber = validatePhoneNumber(rawPhoneNumber);
  const servesInMinistry = parseBooleanCell(rawServesInMinistry);

  const error = (reason: string): BulkImportErrorItem => ({
    row: rowNumber,
    documentID: (documentID ?? normalizeString(rawDocumentID)) || null,
    firstName: firstName || null,
    reason,
  });

  if (!firstName) return error("El nombre es obligatorio");
  if (!lastName) return error("El apellido es obligatorio");
  if (!normalizeString(rawDocumentID)) return error("El documento es obligatorio");
  if (!documentID) return error("El documento debe tener entre 6 y 10 dígitos numéricos");
  if (!normalizeString(rawBirthdate)) return error("La fecha de nacimiento es obligatoria");
  if (!birthdate) return error("La fecha de nacimiento no es válida");
  if (!neighborhood) return error("El barrio es obligatorio");
  if (!normalizeString(rawPhoneNumber)) return error("El número de teléfono es obligatorio");
  if (!phoneNumber) return error("El número de teléfono debe tener exactamente 10 dígitos");
  if (!rawBloodType) return error("El tipo de sangre es obligatorio");
  if (!BLOOD_TYPES.includes(rawBloodType)) return error("El tipo de sangre no es válido");
  if (servesInMinistry === null) return error("Debes indicar si sirve en un ministerio (Si/No)");

  let ministry: string | undefined;
  let ministryInterest: string | undefined;

  if (servesInMinistry) {
    if (!rawMinistry) return error("Debes seleccionar el ministerio en el que sirve");
    if (!MINISTRIES.includes(rawMinistry)) return error("El ministerio en el que sirve no es válido");
    ministry = rawMinistry;
  } else {
    if (!rawMinistryInterest) return error("Debes seleccionar el ministerio en el que está interesado");
    if (!MINISTRIES.includes(rawMinistryInterest)) {
      return error("El ministerio de interés no es válido");
    }
    ministryInterest = rawMinistryInterest;
  }

  if (!rawSpiritualGrowthStage) return error("La ruta de crecimiento espiritual es obligatoria");
  if (!SPIRITUAL_GROWTH_STAGES.includes(rawSpiritualGrowthStage)) {
    return error("La ruta de crecimiento espiritual no es válida");
  }

  if (!rawEncounterStage) return error("El campo Encuentro y Reencuentro es obligatorio");
  if (!ENCOUNTER_STAGES.includes(rawEncounterStage)) {
    return error("El campo Encuentro y Reencuentro no es válido");
  }

  return {
    row: rowNumber,
    firstName,
    lastName,
    documentID,
    birthdate,
    neighborhood,
    phoneNumber,
    bloodType: rawBloodType,
    servesInMinistry,
    ministry,
    ministryInterest,
    spiritualGrowthStage: rawSpiritualGrowthStage,
    encounterStage: rawEncounterStage,
  };
};

interface InsertManyError extends Error {
  insertedDocs?: Array<{ documentID?: string }>;
  writeErrors?: Array<{ err?: { op?: { documentID?: string }; errmsg?: string } }>;
  errors?: Array<{ op?: { documentID?: string }; errmsg?: string }>;
}

const isInsertManyError = (error: unknown): error is InsertManyError =>
  error instanceof Error;

const findInsertErrorReason = (error: InsertManyError, documentID: string): string => {
  const writeErrors = error.writeErrors ?? [];
  for (const writeError of writeErrors) {
    if (writeError.err?.op?.documentID === documentID) {
      return humanizeMongooseError(writeError.err.errmsg ?? "Error al guardar el registro");
    }
  }

  const errors = error.errors ?? [];
  for (const err of errors) {
    if (err.op?.documentID === documentID) {
      return humanizeMongooseError(err.errmsg ?? "Error al guardar el registro");
    }
  }

  return "Error al guardar el registro";
};

const humanizeMongooseError = (message: string): string => {
  const enumMatch = /is not a valid enum value for path [`"']([^`"']+)[`"']/.exec(message);
  if (enumMatch) {
    const path = enumMatch[1];
    if (path === "ministry" || path === "ministryInterest") {
      return "El ministerio no es válido";
    }
    if (path === "spiritualGrowthStage") {
      return "La ruta de crecimiento espiritual no es válida";
    }
    if (path === "encounterStage") {
      return "El campo Encuentro y Reencuentro no es válido";
    }
    if (path === "bloodType") {
      return "El tipo de sangre no es válido";
    }
    return `El campo ${path} no tiene un valor válido`;
  }

  const duplicateMatch = /duplicate key.*documentID/.exec(message);
  if (duplicateMatch) {
    return "Ya existe un miembro con este número de documento";
  }

  return "Error al guardar el registro";
};

export const processBulkImport = async (fileBuffer: Buffer): Promise<BulkImportResult> => {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer" });
  } catch {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const headerRow = rawRows[0];
  if (!Array.isArray(headerRow)) {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const indexByKey = buildHeaderIndex(headerRow);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !indexByKey.has(HEADER_MAP[header]));
  if (missingHeaders.length > 0) {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const dataRows = rawRows.slice(1) as unknown[][];
  if (dataRows.length === 0) {
    throw new AppError(400, "El archivo no es un Excel válido");
  }

  const errors: BulkImportErrorItem[] = [];
  const candidates: ParsedCandidate[] = [];
  const seenDocuments = new Map<string, number>();

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    if (!Array.isArray(row)) continue;

    const rowNumber = index + 2;
    const result = validateRow(row, rowNumber, indexByKey);

    if ("reason" in result) {
      errors.push(result);
      continue;
    }

    if (seenDocuments.has(result.documentID)) {
      errors.push({
        row: rowNumber,
        documentID: result.documentID,
        firstName: result.firstName,
        reason: "Documento duplicado en el archivo",
      });
      continue;
    }

    seenDocuments.set(result.documentID, rowNumber);
    candidates.push(result);
  }

  let toInsertCandidates: ParsedCandidate[] = [];
  let inserted: BulkImportInsertedItem[] = [];

  if (candidates.length > 0) {
    const existingProfiles = await UserProfile.find({
      documentID: { $in: candidates.map((candidate) => candidate.documentID) },
    }).select("documentID");

    const existingDocumentIds = new Set(existingProfiles.map((profile) => profile.documentID));

    toInsertCandidates = candidates.filter((candidate) => {
      if (existingDocumentIds.has(candidate.documentID)) {
        errors.push({
          row: candidate.row,
          documentID: candidate.documentID,
          firstName: candidate.firstName,
          reason: "Ya existe un miembro con este número de documento",
        });
        return false;
      }
      return true;
    });

    if (toInsertCandidates.length > 0) {
      const asistenteRole = await Role.findOne({ name: "Asistente" });
      if (!asistenteRole) {
        throw new AppError(500, "No se encontró el rol Asistente en la base de datos");
      }

      const toInsertDocs = toInsertCandidates.map((candidate) => ({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        documentID: candidate.documentID,
        birthdate: candidate.birthdate,
        neighborhood: candidate.neighborhood,
        phoneNumber: candidate.phoneNumber,
        bloodType: candidate.bloodType,
        baptized: false,
        servesInMinistry: candidate.servesInMinistry,
        ...(candidate.servesInMinistry
          ? { ministry: candidate.ministry }
          : { ministryInterest: candidate.ministryInterest }),
        spiritualGrowthStage: candidate.spiritualGrowthStage,
        encounterStage: candidate.encounterStage,
        role: asistenteRole._id,
      }));

      let insertError: InsertManyError | null = null;
      try {
        await UserProfile.insertMany(toInsertDocs, { ordered: false });
      } catch (error) {
        if (isInsertManyError(error)) {
          insertError = error;
        }
      }

      const insertedProfiles = await UserProfile.find({
        documentID: { $in: toInsertDocs.map((doc) => doc.documentID) },
      }).select("documentID firstName lastName");

      const insertedDocumentIds = new Set(insertedProfiles.map((profile) => profile.documentID));
      const candidateByDocumentId = new Map(toInsertCandidates.map((c) => [c.documentID, c]));

      for (const doc of toInsertDocs) {
        const candidate = candidateByDocumentId.get(doc.documentID);
        if (!candidate) continue;

        if (insertedDocumentIds.has(doc.documentID)) {
          continue;
        }

        const reason = insertError
          ? findInsertErrorReason(insertError, doc.documentID)
          : "Error al guardar el registro";

        errors.push({
          row: candidate.row,
          documentID: candidate.documentID,
          firstName: candidate.firstName,
          reason,
        });
      }

      inserted = insertedProfiles.map((profile) => {
        const candidate = candidateByDocumentId.get(profile.documentID);
        return {
          row: candidate?.row ?? 0,
          documentID: profile.documentID,
          firstName: profile.firstName,
          lastName: profile.lastName,
        };
      });
    }
  }

  // [AUDIT-PENDING] Invocar servicio de auditoría para la acción `members.bulkImport`
  // con contexto `{ total, insertedCount, failedCount }` cuando el módulo exista.
  // Ver ADR-0001 §ET-1.

  emitRealtimeInvalidation("members.changed", MEMBER_QUERY_KEYS);

  return {
    total: dataRows.length,
    insertedCount: inserted.length,
    failedCount: errors.length,
    inserted,
    errors,
  };
};
