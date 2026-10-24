import { procedureMaster } from "../../domain/procedure-master";

// The procedure master as a compact prompt table: id, names in every language the master has, unit.
// Claude picks ids from this list only (or "unknown").

export const PROCEDURE_ID_TABLE = [
  "| id | names | unit |",
  "| --- | --- | --- |",
  ...procedureMaster.map((procedure) => {
    const names = Object.values(procedure.name).filter(Boolean).join(" / ");
    return `| ${procedure.id} | ${names} | ${procedure.unit ?? "-"} |`;
  }),
].join("\n");
