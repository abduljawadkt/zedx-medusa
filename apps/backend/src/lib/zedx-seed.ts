import type { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

import {
  skuFromSlug,
  slugify,
} from "../migration-scripts/initial-data-seed"
import { categories as zedxCategories } from "../seed-data/categories"
import { products as zedxProducts } from "../seed-data/products"

const DEFAULT_PUBLIC_ASSET_BASE_URL =
  "https://raw.githubusercontent.com/abduljawadkt/zedx/main/public"

export async function getZedxProductCount(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
  })

  return data.length
}

function publicAssetUrl(assetPath: string) {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath
  }

  const baseUrl =
    process.env.ZEDX_PUBLIC_ASSET_URL ||
    process.env.ZEDX_STOREFRONT_ASSET_URL ||
    DEFAULT_PUBLIC_ASSET_BASE_URL

  const encodedPath = assetPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")

  return `${baseUrl.replace(/\/+$/, "")}${encodedPath.startsWith("/") ? encodedPath : `/${encodedPath}`}`
}

export async function repairZedxProductImages(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail"],
  })

  const productByHandle = new Map(
    zedxProducts.map((product) => [product.slug, product])
  )
  const updates = existingProducts
    .map((existingProduct) => {
      const sourceProduct = productByHandle.get(existingProduct.handle)

      if (!sourceProduct) {
        return undefined
      }

      const gallery = sourceProduct.gallery?.length
        ? sourceProduct.gallery
        : [sourceProduct.image]
      const thumbnail = publicAssetUrl(sourceProduct.image)

      return {
        selector: {
          id: existingProduct.id,
        },
        update: {
          thumbnail,
          images: gallery.map((image) => ({
            url: publicAssetUrl(image),
          })),
          metadata: {
            ...sourceProduct,
            image_base_url:
              process.env.ZEDX_PUBLIC_ASSET_URL ||
              process.env.ZEDX_STOREFRONT_ASSET_URL ||
              DEFAULT_PUBLIC_ASSET_BASE_URL,
            repaired_image_urls_at: new Date().toISOString(),
          },
        },
      }
    })
    .filter(Boolean) as {
    selector: { id: string }
    update: {
      thumbnail: string
      images: { url: string }[]
      metadata: Record<string, unknown>
    }
  }[]

  for (const update of updates) {
    await updateProductsWorkflow(container).run({
      input: update,
    })
  }

  return {
    repairedCount: updates.length,
    assetBaseUrl:
      process.env.ZEDX_PUBLIC_ASSET_URL ||
      process.env.ZEDX_STOREFRONT_ASSET_URL ||
      DEFAULT_PUBLIC_ASSET_BASE_URL,
  }
}

export async function seedZedxCatalogIfEmpty(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const beforeCount = await getZedxProductCount(container)

  if (beforeCount > 0) {
    const imageRepair = await repairZedxProductImages(container)

    return {
      seeded: false,
      beforeCount,
      afterCount: beforeCount,
      imageRepair,
      message: "Products already exist. ZEDX seed was skipped and image URLs were repaired.",
    }
  }

  const categories = zedxCategories
  const products = zedxProducts
  const collections = Array.from(new Set(products.map((product) => product.collection)))

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile = shippingProfiles[0]

  if (!shippingProfile) {
    throw new Error("No Medusa shipping profile found. Create a default shipping profile before seeding products.")
  }

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  let salesChannelId = (salesChannels.find((channel) =>
    String(channel.name).toLowerCase().includes("zedx")
  ) || salesChannels[0])?.id

  if (!salesChannelId) {
    const {
      result: [createdSalesChannel],
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
    salesChannelId = createdSalesChannel.id
  }

  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const categoryIdByHandle = new Map(
    existingCategories.map((category) => [category.handle, category.id])
  )
  const missingCategories = categories.filter(
    (category) => !categoryIdByHandle.has(category.slug)
  )

  if (missingCategories.length) {
    const { result: createdCategories } =
      await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: missingCategories.map((category, index) => ({
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

    createdCategories.forEach((category) => {
      categoryIdByHandle.set(category.handle, category.id)
    })
  }

  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "handle"],
  })
  const collectionIdByHandle = new Map(
    existingCollections.map((collection) => [collection.handle, collection.id])
  )
  const missingCollections = collections.filter(
    (collection) => !collectionIdByHandle.has(slugify(collection))
  )

  if (missingCollections.length) {
    const { result: createdCollections } =
      await createCollectionsWorkflow(container).run({
        input: {
          collections: missingCollections.map((collection) => ({
            title: collection,
            handle: slugify(collection),
          })),
        },
      })

    createdCollections.forEach((collection) => {
      collectionIdByHandle.set(collection.handle, collection.id)
    })
  }

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingProductHandles = new Set(
    existingProducts.map((product) => product.handle)
  )
  const missingProducts = products.filter(
    (product) => !existingProductHandles.has(product.slug)
  )

  if (missingProducts.length) {
    await createProductsWorkflow(container).run({
      input: {
        products: missingProducts.map((product) => {
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
            thumbnail: publicAssetUrl(product.image),
            images: gallery.map((image) => ({
              url: publicAssetUrl(image),
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
                manage_inventory: false,
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
                id: salesChannelId,
              },
            ],
            metadata: {
              source: "zedx-cloud-seed",
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
  }

  const afterCount = await getZedxProductCount(container)
  const imageRepair = await repairZedxProductImages(container)

  return {
    seeded: missingProducts.length > 0,
    beforeCount,
    afterCount,
    imageRepair,
    message: `Seeded ${afterCount - beforeCount} ZEDX products.`,
  }
}

export function serializeSeedError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    }
  }

  return {
    message: String(error),
  }
}
