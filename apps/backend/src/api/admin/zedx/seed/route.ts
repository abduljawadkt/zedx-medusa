import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import initialDataSeed from "../../../../migration-scripts/initial-data-seed"

function getSeedToken(req: MedusaRequest) {
  const rawQueryToken = req.query?.token
  const queryToken = Array.isArray(rawQueryToken) ? rawQueryToken[0] : rawQueryToken
  const headerToken = req.headers["x-zedx-seed-token"]

  return queryToken || (Array.isArray(headerToken) ? headerToken[0] : headerToken)
}

async function getProductCount(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
  })

  return data.length
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const configuredToken = process.env.ZEDX_SEED_TOKEN
  const requestToken = getSeedToken(req)

  if (configuredToken && requestToken !== configuredToken) {
    return res.status(401).json({
      ok: false,
      message: "Invalid ZEDX seed token.",
    })
  }

  const beforeCount = await getProductCount(req)

  if (beforeCount > 0) {
    return res.status(200).json({
      ok: true,
      seeded: false,
      before_count: beforeCount,
      after_count: beforeCount,
      message: "Products already exist. ZEDX seed was skipped.",
    })
  }

  await initialDataSeed({
    container: req.scope as unknown as MedusaContainer,
  })

  const afterCount = await getProductCount(req)

  return res.status(200).json({
    ok: true,
    seeded: true,
    before_count: beforeCount,
    after_count: afterCount,
    message: `Seeded ${afterCount} ZEDX products.`,
  })
}
