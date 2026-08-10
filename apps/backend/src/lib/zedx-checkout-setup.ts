import type { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

type SetupStatus = {
  regionId?: string
  shippingOptionCount: number
  createdRegion: boolean
  createdShippingOptions: boolean
  createdStockLocation: boolean
}

export async function ensureZedxCheckoutSetup(
  container: MedusaContainer
): Promise<SetupStatus> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  let regionId = existingRegions.find((item) =>
    item.countries?.some((country) => country?.iso_2?.toLowerCase() === "ae")
  )
    ?.id
  let createdRegion = false

  if (!regionId) {
    const {
      result: [created],
    } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "UAE",
            currency_code: "aed",
            countries: ["ae"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    regionId = created.id
    createdRegion = true
  }

  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  if (
    !existingTaxRegions.some(
      (taxRegion) => taxRegion.country_code?.toLowerCase() === "ae"
    )
  ) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "ae",
          provider_id: "tp_system",
        },
      ],
    })
  }

  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })

  if (existingShippingOptions.length > 0) {
    return {
      regionId,
      shippingOptionCount: existingShippingOptions.length,
      createdRegion,
      createdShippingOptions: false,
      createdStockLocation: false,
    }
  }

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile = shippingProfiles[0]

  if (!shippingProfile) {
    throw new Error("No Medusa shipping profile found.")
  }

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const salesChannel = salesChannels.find((channel) =>
    String(channel.name).toLowerCase().includes("zedx")
  ) || salesChannels[0]

  if (!salesChannel) {
    throw new Error("No Medusa sales channel found.")
  }

  const {
    result: [stockLocation],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "ZedX UAE Warehouse",
          address: {
            city: "Dubai",
            country_code: "AE",
            address_1: "ZedX UAE fulfillment center",
          },
        },
      ],
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  })

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "ZedX UAE delivery",
    type: "shipping",
    service_zones: [
      {
        name: "UAE",
        geo_zones: [
          {
            country_code: "ae",
            type: "country",
          },
        ],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "UAE Standard Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Dubai and UAE delivery.",
          code: "uae-standard",
        },
        prices: [
          {
            currency_code: "aed",
            amount: 18,
          },
          {
            region_id: regionId,
            amount: 18,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Store Pickup",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Pickup",
          description: "Collect from ZedX after confirmation.",
          code: "store-pickup",
        },
        prices: [
          {
            currency_code: "aed",
            amount: 0,
          },
          {
            region_id: regionId,
            amount: 0,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [salesChannel.id],
    },
  })

  return {
    regionId,
    shippingOptionCount: 2,
    createdRegion,
    createdShippingOptions: true,
    createdStockLocation: true,
  }
}
