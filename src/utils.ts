import { z } from "zod";

// zod 4: refinements no longer wrap the schema, so only wrapper types
// (optional, nullable, default, ...) need unwrapping via def.innerType.
export function isZodType(t: z.ZodType, type: string): boolean {
  const def: any = (t as any).def;
  if (def?.type === type) {
    return true;
  }
  if (def?.innerType) {
    return isZodType(def.innerType, type);
  }
  return false;
}
