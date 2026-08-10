import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework"
import {
  ensureZedxCheckoutSetup,
} from "../../../lib/zedx-checkout-setup"
import { serializeSeedError } from "../../../lib/zedx-seed"

function getConfirmValue(req: MedusaRequest) {
  const rawConfirm = req.query?.confirm

  return Array.isArray(rawConfirm) ? rawConfirm[0] : rawConfirm
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (getConfirmValue(req) !== "setup-zedx-checkout") {
    return res.status(404).json({
      ok: false,
      message: "Checkout setup endpoint not found.",
    })
  }

  try {
    const result = await ensureZedxCheckoutSetup(
      req.scope as unknown as MedusaContainer
    )

    return res.status(200).json({
      ok: true,
      build: "zedx-checkout-setup-v1",
      result,
      message: "ZEDX UAE checkout configuration is ready.",
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      build: "zedx-checkout-setup-v1",
      error: serializeSeedError(error),
    })
  }
}
