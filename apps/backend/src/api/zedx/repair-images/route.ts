import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework"
import {
  repairZedxProductImages,
  serializeSeedError,
} from "../../../lib/zedx-seed"

function getConfirmValue(req: MedusaRequest) {
  const rawConfirm = req.query?.confirm

  return Array.isArray(rawConfirm) ? rawConfirm[0] : rawConfirm
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (getConfirmValue(req) !== "repair-zedx-images") {
    return res.status(404).json({
      ok: false,
      message: "Repair endpoint not found.",
    })
  }

  try {
    const result = await repairZedxProductImages(
      req.scope as unknown as MedusaContainer
    )

    return res.status(200).json({
      ok: true,
      build: "zedx-seed-v4",
      ...result,
      message: `Repaired image URLs for ${result.repairedCount} ZEDX products.`,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      build: "zedx-seed-v4",
      error: serializeSeedError(error),
    })
  }
}
