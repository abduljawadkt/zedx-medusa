import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

type GraphResult<T> =
  | {
      ok: true
      data: T[]
      count: number
    }
  | {
      ok: false
      data: T[]
      count: 0
      error: string
    }

function getConfirmValue(req: MedusaRequest) {
  const rawConfirm = req.query?.confirm

  return Array.isArray(rawConfirm) ? rawConfirm[0] : rawConfirm
}

async function safeGraph<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[]
): Promise<GraphResult<T>> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity,
      fields,
    })

    return {
      ok: true,
      data: data as T[],
      count: data.length,
    }
  } catch (error) {
    return {
      ok: false,
      data: [] as T[],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function publicFields<T extends Record<string, unknown>>(item: T) {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !["secret", "salt", "hash"].includes(key))
  )
}

async function ensurePublishableKey(container: MedusaContainer) {
  const apiKeys = await safeGraph<Record<string, unknown>>(container, "api_key", [
    "id",
    "title",
    "type",
    "token",
  ])
  const existing = apiKeys.data.find((apiKey) => apiKey.type === "publishable")

  if (existing) {
    return {
      created: false,
      apiKey: publicFields(existing),
    }
  }

  const salesChannels = await safeGraph<Record<string, unknown>>(container, "sales_channel", [
    "id",
    "name",
  ])
  const salesChannel = salesChannels.data.find((channel) =>
    String(channel.name).toLowerCase().includes("zedx")
  ) || salesChannels.data[0]

  const {
    result: [apiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "ZEDX Vercel Storefront Publishable Key",
          type: "publishable",
          created_by: "zedx-readiness",
        },
      ],
    },
  })

  if (salesChannel?.id) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: apiKey.id,
        add: [String(salesChannel.id)],
      },
    })
  }

  return {
    created: true,
    apiKey: publicFields(apiKey as unknown as Record<string, unknown>),
    linkedSalesChannelId: salesChannel?.id ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope as unknown as MedusaContainer
  const shouldPrepare = getConfirmValue(req) === "prepare-storefront"

  const [
    products,
    regions,
    salesChannels,
    shippingOptions,
    paymentProviders,
    apiKeys,
  ] = await Promise.all([
    safeGraph<Record<string, unknown>>(container, "product", [
      "id",
      "handle",
      "thumbnail",
      "images.url",
      "variants.id",
    ]),
    safeGraph<Record<string, unknown>>(container, "region", [
      "id",
      "name",
      "currency_code",
      "countries.iso_2",
    ]),
    safeGraph<Record<string, unknown>>(container, "sales_channel", ["id", "name"]),
    safeGraph<Record<string, unknown>>(container, "shipping_option", ["id", "name"]),
    safeGraph<Record<string, unknown>>(container, "payment_provider", ["id"]),
    safeGraph<Record<string, unknown>>(container, "api_key", [
      "id",
      "title",
      "type",
      "token",
    ]),
  ])

  const publishableKeys = apiKeys.data
    .filter((apiKey) => apiKey.type === "publishable")
    .map(publicFields)
  const imageSample = products.data.slice(0, 8).map((product) => ({
    handle: product.handle,
    thumbnail: product.thumbnail,
    imageCount: Array.isArray(product.images) ? product.images.length : 0,
    variantCount: Array.isArray(product.variants) ? product.variants.length : 0,
  }))
  const readiness = {
    products: products.count >= 84,
    productImages: imageSample.every((product) =>
      String(product.thumbnail || "").startsWith("https://")
    ),
    regions: regions.count > 0,
    salesChannels: salesChannels.count > 0,
    shippingOptions: shippingOptions.count > 0,
    paymentProviders: paymentProviders.count > 0,
    publishableApiKey: publishableKeys.length > 0,
  }
  const prepared = shouldPrepare ? await ensurePublishableKey(container) : null

  return res.status(200).json({
    ok: Object.values(readiness).every(Boolean),
    build: "zedx-readiness-v1",
    readiness,
    counts: {
      products: products.count,
      regions: regions.count,
      salesChannels: salesChannels.count,
      shippingOptions: shippingOptions.count,
      paymentProviders: paymentProviders.count,
      publishableApiKeys: publishableKeys.length,
    },
    publishableKeys,
    prepared,
    samples: {
      images: imageSample,
      regions: regions.data,
      salesChannels: salesChannels.data,
      shippingOptions: shippingOptions.data,
      paymentProviders: paymentProviders.data,
    },
    errors: {
      products: products.ok ? undefined : products.error,
      regions: regions.ok ? undefined : regions.error,
      salesChannels: salesChannels.ok ? undefined : salesChannels.error,
      shippingOptions: shippingOptions.ok ? undefined : shippingOptions.error,
      paymentProviders: paymentProviders.ok ? undefined : paymentProviders.error,
      apiKeys: apiKeys.ok ? undefined : apiKeys.error,
    },
  })
}
