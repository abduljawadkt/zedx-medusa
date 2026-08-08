import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import initialDataSeed from "../migration-scripts/initial-data-seed"

export async function getZedxProductCount(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
  })

  return data.length
}

export async function seedZedxCatalogIfEmpty(container: MedusaContainer) {
  const beforeCount = await getZedxProductCount(container)

  if (beforeCount > 0) {
    return {
      seeded: false,
      beforeCount,
      afterCount: beforeCount,
      message: "Products already exist. ZEDX seed was skipped.",
    }
  }

  await initialDataSeed({
    container,
  })

  const afterCount = await getZedxProductCount(container)

  return {
    seeded: true,
    beforeCount,
    afterCount,
    message: `Seeded ${afterCount} ZEDX products.`,
  }
}
