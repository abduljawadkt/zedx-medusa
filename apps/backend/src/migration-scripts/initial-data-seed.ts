import fs from "node:fs"
import path from "node:path"
import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

type ZedxCategory = {
  slug: string
  name: string
  description: string
  collection: string
  image: string
}

type ZedxProduct = {
  id: string
  name: string
  slug: string
  category: string
  categorySlug: string
  collection: string
  price: number
  oldPrice: number
  currency: string
  badge: string
  color: string
  image: string
  gallery: string[]
  shortDescription: string
  description: string
  specs: string[]
  highlights: string[]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function readCatalogArray<T>(source: string, exportName: string): T[] {
  const match = source.match(new RegExp(`export const ${exportName} = ([\\s\\S]*?\\n]) satisfies`))
  if (!match) {
    throw new Error(`Unable to read ${exportName} from ZedX frontend catalog.`)
  }

  return JSON.parse(match[1]) as T[]
}

function loadZedxCatalog() {
  const frontendPath =
    process.env.ZEDX_FRONTEND_PATH ||
    path.resolve(process.cwd(), "../../../zedx")
  const productSource = fs.readFileSync(
    path.join(frontendPath, "src/data/products.ts"),
    "utf8"
  )
  const categorySource = fs.readFileSync(
    path.join(frontendPath, "src/data/categories.ts"),
    "utf8"
  )

  const products = readCatalogArray<ZedxProduct>(productSource, "products")
  const categories = readCatalogArray<ZedxCategory>(categorySource, "categories")
  const collections = Array.from(new Set(products.map((product) => product.collection)))

  return { categories, collections, products }
}

function storefrontAssetUrl(assetPath: string) {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath
  }

  const baseUrl = process.env.ZEDX_STOREFRONT_ASSET_URL || "http://localhost:3000"
  return `${baseUrl.replace(/\/+$/, "")}${assetPath}`
}

function skuFromSlug(slug: string) {
  return slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )

  const { categories, collections, products } = loadZedxCatalog()
  const countries = ["ae"]

  logger.info("Seeding ZedX UAE store data...")
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "ZedX Online Store",
          description: "Primary ZedX ecommerce sales channel",
        },
      ],
    },
  })

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "ZedX Storefront Publishable Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  })

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  })

  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "zedx",
          supported_currencies: [
            {
              currency_code: "aed",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  })

  logger.info("Seeding UAE region data...")
  const {
    result: [region],
  } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "UAE",
          currency_code: "aed",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })

  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  })
  logger.info("Finished UAE region and tax data.")

  logger.info("Seeding UAE stock location and fulfillment data...")
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

  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfileResult[0]

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
            region_id: region.id,
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
            region_id: region.id,
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
      add: [defaultSalesChannel.id],
    },
  })
  logger.info("Finished ZedX stock location and fulfillment data.")

  logger.info("Seeding ZedX categories, collections, and products...")
  const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: categories.map((category, index) => ({
        name: category.name,
        description: category.description,
        handle: category.slug,
        is_active: true,
        is_internal: false,
        rank: index,
        metadata: {
          collection: category.collection,
          image: category.image,
        },
      })),
    },
  })

  const { result: collectionResult } = await createCollectionsWorkflow(container).run({
    input: {
      collections: collections.map((collection) => ({
        title: collection,
        handle: slugify(collection),
      })),
    },
  })

  const categoryIdByHandle = new Map(categoryResult.map((category) => [category.handle, category.id]))
  const collectionIdByHandle = new Map(collectionResult.map((collection) => [collection.handle, collection.id]))

  await createProductsWorkflow(container).run({
    input: {
      products: products.map((product) => {
        const gallery = product.gallery?.length ? product.gallery : [product.image]
        const categoryId = categoryIdByHandle.get(product.categorySlug)
        const collectionId = collectionIdByHandle.get(slugify(product.collection))

        return {
          title: product.name,
          subtitle: product.shortDescription,
          description: product.description,
          handle: product.slug,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          thumbnail: storefrontAssetUrl(product.image),
          images: gallery.map((image) => ({
            url: storefrontAssetUrl(image),
          })),
          category_ids: categoryId ? [categoryId] : [],
          collection_id: collectionId,
          options: [
            {
              title: "Color",
              values: [product.color || "Default"],
            },
          ],
          variants: [
            {
              title: product.color || "Default",
              sku: skuFromSlug(product.slug),
              manage_inventory: true,
              options: {
                Color: product.color || "Default",
              },
              prices: [
                {
                  amount: product.price,
                  currency_code: "aed",
                },
              ],
              metadata: {
                source_product_id: product.id,
                old_price: product.oldPrice,
                color: product.color,
              },
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
          metadata: {
            source: "zedx-frontend",
            source_product_id: product.id,
            badge: product.badge,
            color: product.color,
            category: product.category,
            category_slug: product.categorySlug,
            collection: product.collection,
            old_price: product.oldPrice,
            local_image: product.image,
            local_gallery: gallery,
            specs: product.specs,
            highlights: product.highlights,
          },
        }
      }),
    },
  })
  logger.info(`Finished seeding ${products.length} ZedX products.`)

  logger.info("Seeding ZedX inventory levels.")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 250,
        inventory_item_id: item.id,
      })),
    },
  })

  logger.info("Finished seeding ZedX inventory levels.")
}
