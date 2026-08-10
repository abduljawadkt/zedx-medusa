import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework"
import { seedZedxCatalogIfEmpty } from "../../../lib/zedx-seed"

function getConfirmValue(req: MedusaRequest) {
  const rawConfirm = req.query?.confirm

  return Array.isArray(rawConfirm) ? rawConfirm[0] : rawConfirm
}

function serializeSeedError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (getConfirmValue(req) !== "seed-zedx-catalog") {
    return res.status(404).json({
      ok: false,
      message: "Seed endpoint not found.",
    })
  }

  try {
    const result = await seedZedxCatalogIfEmpty(
      req.scope as unknown as MedusaContainer
    )

    return res.status(200).json({
      ok: true,
      build: "zedx-seed-v4",
      seeded: result.seeded,
      before_count: result.beforeCount,
      after_count: result.afterCount,
      message: result.message,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      build: "zedx-seed-v4",
      error: serializeSeedError(error),
    })
  }
}
