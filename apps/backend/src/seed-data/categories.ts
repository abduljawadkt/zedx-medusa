export type Category = {
  slug: string;
  name: string;
  description: string;
  accent: "blue" | "violet" | "green" | "silver";
  collection: string;
  image: string;
  productCount: number;
};

export const categories = [
  {
    "slug": "tablets",
    "name": "Tablets",
    "description": "Portable screens built for entertainment, travel, study, and light productivity.",
    "accent": "blue",
    "collection": "Mobile Computing",
    "image": "/hero-animation/dock.png",
    "productCount": 9
  },
  {
    "slug": "smart-watches",
    "name": "Smart Watches",
    "description": "Refined wearables with vivid displays, fitness tools, and everyday notifications.",
    "accent": "green",
    "collection": "Smart Wearables",
    "image": "/hero-animation/watch.png",
    "productCount": 7
  },
  {
    "slug": "earpods",
    "name": "Wireless Earbuds",
    "description": "Compact wireless audio for calls, gaming, commute, and daily focus.",
    "accent": "blue",
    "collection": "Audio",
    "image": "/hero-animation/earbuds.png",
    "productCount": 17
  },
  {
    "slug": "over-heads",
    "name": "Over-Ear Headphones",
    "description": "Over-ear headphones tuned for comfort, bass, and immersive listening.",
    "accent": "violet",
    "collection": "Audio",
    "image": "/hero-animation/headphones.png",
    "productCount": 3
  },
  {
    "slug": "wired-headphones",
    "name": "Wired Headphones",
    "description": "Reliable wired listening essentials with Type-C and classic in-ear formats.",
    "accent": "silver",
    "collection": "Audio",
    "image": "/hero-animation/headphones.png",
    "productCount": 6
  },
  {
    "slug": "neck-band",
    "name": "Neckbands",
    "description": "Flexible all-day wireless audio made for movement and long calls.",
    "accent": "green",
    "collection": "Audio",
    "image": "/hero-animation/earbuds.png",
    "productCount": 3
  },
  {
    "slug": "adapters",
    "name": "Adapters",
    "description": "Travel-ready charging adapters for international workdays and fast device top-ups.",
    "accent": "silver",
    "collection": "Travel Power",
    "image": "/products/Zedx World Travel Adapter (70w) Gan.jpg",
    "productCount": 2
  },
  {
    "slug": "chargers",
    "name": "Chargers",
    "description": "GaN wall chargers, power strips, docks, and multi-device fast charging stations.",
    "accent": "blue",
    "collection": "Power",
    "image": "/hero-animation/dock.png",
    "productCount": 11
  },
  {
    "slug": "car-chargers",
    "name": "Car Chargers",
    "description": "Compact high-output charging for commutes, road trips, and dashboard setups.",
    "accent": "green",
    "collection": "Auto Power",
    "image": "/hero-animation/mount.png",
    "productCount": 6
  },
  {
    "slug": "power-banks",
    "name": "Power Banks",
    "description": "Pocketable reserve power for phones, tablets, travel, and busy workdays.",
    "accent": "blue",
    "collection": "Portable Power",
    "image": "/products/Zedx Power Bank 10000(Zx-pb115).jpg",
    "productCount": 2
  },
  {
    "slug": "car-holders",
    "name": "Car Mounts",
    "description": "Magnetic, suction, and 360-degree mounts for cleaner driving and desk visibility.",
    "accent": "silver",
    "collection": "Mounts",
    "image": "/hero-animation/mount.png",
    "productCount": 9
  },
  {
    "slug": "charging-cables",
    "name": "Charging Cables",
    "description": "Durable Type-C, Lightning, and retractable cables for fast everyday charging.",
    "accent": "violet",
    "collection": "Essentials",
    "image": "/products/ZEDX FAST DATA CABLE 1M-TYPE-C.jpg",
    "productCount": 8
  },
  {
    "slug": "speakers",
    "name": "Speakers",
    "description": "Portable wireless sound with compact bodies and bold desk-ready styling.",
    "accent": "violet",
    "collection": "Audio",
    "image": "/hero-animation/speaker.png",
    "productCount": 1
  }
] satisfies Category[];

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
