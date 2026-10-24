import codes from "../../zk/codes.json";

// Circuit field codes (zk/codes.json): 0 means an empty slot or "any", so real ids start at 1.
const procedures: Readonly<Record<string, number>> = codes.procedures;
const clinics: Readonly<Record<string, number>> = codes.clinics;

const lookup = (table: Readonly<Record<string, number>>, kind: string, id: string): number => {
  const code = Object.hasOwn(table, id) ? table[id] : undefined;
  if (code === undefined) throw new Error(`unknown ${kind} id: ${id}`);
  return code;
};

const reverse = (table: Readonly<Record<string, number>>, kind: string, code: number): string => {
  const id = Object.keys(table).find((key) => table[key] === code);
  if (id === undefined) throw new Error(`unknown ${kind} code: ${code}`);
  return id;
};

export const procedureCode = (id: string): number => lookup(procedures, "procedure", id);
export const clinicCode = (id: string): number => lookup(clinics, "clinic", id);
export const procedureIdByCode = (code: number): string => reverse(procedures, "procedure", code);
export const clinicIdByCode = (code: number): string => reverse(clinics, "clinic", code);
