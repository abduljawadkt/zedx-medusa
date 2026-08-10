import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({
    ok: true,
    build: "zedx-seed-v4",
    message: "ZEDX Medusa backend route is deployed.",
    time: new Date().toISOString(),
  })
}
