import { z } from "zod";
import { AmountSchema, IsoDateSchema, KrwSchema } from "../../a2a/schemas";
import { ProcedureIdOrUnknownSchema } from "./common";

// extract_menu_items (04 "가격표 추출", ops "대행 병원 생성"). The procedureId comes from the master or is
// "unknown" and the clinic is asked. Every row keeps the source line so the operator can tick it off;
// rows that are not confirmed are not saved (04 가격표 추출 3).

export const MenuItemExtractSchema = z.strictObject({
  procedureId: ProcedureIdOrUnknownSchema,
  product: z.string().trim().min(1),
  amount: AmountSchema,
  priceKrw: KrwSchema,
  vatIncluded: z.boolean(),
  includes: z.array(z.string().trim().min(1)),
  /** True only when the source says so. The 04 menu slot asks the clinic to confirm it. */
  foreignerSamePrice: z.boolean().optional(),
  /** An event row: all five promotion fields are needed before it can be published (art. 23). */
  event: z
    .strictObject({
      title: z.string().trim().min(1),
      regularPriceKrw: KrwSchema.optional(),
      validFrom: IsoDateSchema.optional(),
      validUntil: IsoDateSchema.optional(),
      conditions: z.string().trim().min(1).optional(),
    })
    .optional(),
  /** The line the row was read from, verbatim. */
  sourceText: z.string().trim().min(1),
});

export const ExtractMenuItemsInputSchema = z.strictObject({
  items: z.array(MenuItemExtractSchema),
});

export type MenuItemExtract = z.infer<typeof MenuItemExtractSchema>;
export type ExtractMenuItemsInput = z.infer<typeof ExtractMenuItemsInputSchema>;
