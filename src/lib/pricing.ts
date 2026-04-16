/**
 * Thin re-export shim — all pricing logic has moved to src/lib/models/.
 *
 * Existing imports of "@/lib/pricing" continue to work unchanged.
 * New code should import from "@/lib/models" directly.
 */
export { calculateCost, getInputCostPer1M } from "@/lib/models"
export type { CostResult } from "@/lib/models"
