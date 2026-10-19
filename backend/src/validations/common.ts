import { z } from "zod";
import { parseDateText } from "@fm/shared/dates";

export const idSchema = z.uuid();

// A date as the forms send it: dd/mm/yyyy as shown on screen, or "YYYY-MM-DD". Turned into "YYYY-MM-DD"
// for the checks that follow; text that is not a real date is passed on unchanged, so they reject it.
export const dateText = z.string().transform((value) => parseDateText(value) ?? value.trim());
