/** A small, hand-picked catalog of bright, easy-to-spot stars (J2000 RA in
 * degrees, Dec in degrees, apparent visual magnitude) grouped into a few
 * kid-friendly constellations/asterisms well-placed for mid-northern
 * latitudes like Merrimack, NH. This is meant for a fun educational sky
 * view, not precision astrometry. */

export interface CatalogStar {
  name: string;
  raDeg: number;
  decDeg: number;
  mag: number;
}

export interface Constellation {
  id: string;
  name: string;
  blurb: string;
  stars: string[];
  /** Pairs of star names to draw as connecting lines. */
  lines: [string, string][];
}

export const STARS: CatalogStar[] = [
  // Big Dipper (part of Ursa Major)
  { name: "Dubhe", raDeg: 165.932, decDeg: 61.751, mag: 1.79 },
  { name: "Merak", raDeg: 165.46, decDeg: 56.382, mag: 2.37 },
  { name: "Phecda", raDeg: 178.458, decDeg: 53.695, mag: 2.44 },
  { name: "Megrez", raDeg: 183.857, decDeg: 57.033, mag: 3.32 },
  { name: "Alioth", raDeg: 193.507, decDeg: 55.96, mag: 1.77 },
  { name: "Mizar", raDeg: 200.981, decDeg: 54.925, mag: 2.23 },
  { name: "Alkaid", raDeg: 206.885, decDeg: 49.313, mag: 1.86 },

  // Cassiopeia
  { name: "Schedar", raDeg: 10.127, decDeg: 56.537, mag: 2.24 },
  { name: "Caph", raDeg: 2.295, decDeg: 59.15, mag: 2.28 },
  { name: "Gamma Cas", raDeg: 14.177, decDeg: 60.717, mag: 2.47 },
  { name: "Ruchbah", raDeg: 21.454, decDeg: 60.235, mag: 2.68 },
  { name: "Segin", raDeg: 28.599, decDeg: 63.67, mag: 3.38 },

  // Little Dipper (Ursa Minor)
  { name: "Polaris", raDeg: 37.955, decDeg: 89.264, mag: 1.98 },
  { name: "Kochab", raDeg: 222.676, decDeg: 74.156, mag: 2.08 },
  { name: "Pherkad", raDeg: 230.182, decDeg: 71.834, mag: 3.05 },

  // Orion
  { name: "Betelgeuse", raDeg: 88.793, decDeg: 7.407, mag: 0.42 },
  { name: "Rigel", raDeg: 78.634, decDeg: -8.202, mag: 0.13 },
  { name: "Bellatrix", raDeg: 81.283, decDeg: 6.35, mag: 1.64 },
  { name: "Saiph", raDeg: 86.939, decDeg: -9.67, mag: 2.09 },
  { name: "Alnitak", raDeg: 85.19, decDeg: -1.943, mag: 1.74 },
  { name: "Alnilam", raDeg: 84.053, decDeg: -1.202, mag: 1.69 },
  { name: "Mintaka", raDeg: 83.002, decDeg: -0.299, mag: 2.23 },

  // Summer Triangle (asterism)
  { name: "Vega", raDeg: 279.234, decDeg: 38.784, mag: 0.03 },
  { name: "Deneb", raDeg: 310.358, decDeg: 45.28, mag: 1.25 },
  { name: "Altair", raDeg: 297.696, decDeg: 8.868, mag: 0.76 },

  // A handful of standalone bright stars
  { name: "Sirius", raDeg: 101.287, decDeg: -16.716, mag: -1.46 },
  { name: "Arcturus", raDeg: 213.915, decDeg: 19.182, mag: -0.05 },
  { name: "Capella", raDeg: 79.172, decDeg: 45.998, mag: 0.08 },
  { name: "Procyon", raDeg: 114.825, decDeg: 5.225, mag: 0.34 },
  { name: "Aldebaran", raDeg: 68.98, decDeg: 16.509, mag: 0.86 },
  { name: "Spica", raDeg: 201.298, decDeg: -11.161, mag: 1.04 },
  { name: "Regulus", raDeg: 152.093, decDeg: 11.967, mag: 1.35 },
  { name: "Pollux", raDeg: 116.329, decDeg: 28.026, mag: 1.14 },
  { name: "Castor", raDeg: 113.649, decDeg: 31.888, mag: 1.58 },
  { name: "Antares", raDeg: 247.352, decDeg: -26.432, mag: 1.06 },
];

export const CONSTELLATIONS: Constellation[] = [
  {
    id: "ursa-major",
    name: "The Big Dipper",
    blurb:
      "Seven bright stars that form a big spoon shape! It's part of a bigger bear-shaped constellation called Ursa Major, and it points the way to the North Star.",
    stars: ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"],
    lines: [
      ["Dubhe", "Merak"],
      ["Merak", "Phecda"],
      ["Phecda", "Megrez"],
      ["Megrez", "Dubhe"],
      ["Megrez", "Alioth"],
      ["Alioth", "Mizar"],
      ["Mizar", "Alkaid"],
    ],
  },
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    blurb:
      "Five stars that make a wide 'W' (or 'M') shape across the sky, named after a queen in an old Greek story. It's almost always visible from the northern half of Earth.",
    stars: ["Caph", "Schedar", "Gamma Cas", "Ruchbah", "Segin"],
    lines: [
      ["Caph", "Schedar"],
      ["Schedar", "Gamma Cas"],
      ["Gamma Cas", "Ruchbah"],
      ["Ruchbah", "Segin"],
    ],
  },
  {
    id: "ursa-minor",
    name: "The Little Dipper",
    blurb:
      "A smaller spoon shape whose handle-tip star, Polaris, is the North Star — it barely moves all night, so sailors and hikers have used it for centuries to find north!",
    stars: ["Polaris", "Kochab", "Pherkad"],
    lines: [
      ["Polaris", "Kochab"],
      ["Kochab", "Pherkad"],
    ],
  },
  {
    id: "orion",
    name: "Orion the Hunter",
    blurb:
      "One of the easiest constellations to spot: look for three stars in a neat row (Orion's Belt) between his bright shoulder and knee stars.",
    stars: ["Betelgeuse", "Bellatrix", "Rigel", "Saiph", "Alnitak", "Alnilam", "Mintaka"],
    lines: [
      ["Betelgeuse", "Bellatrix"],
      ["Bellatrix", "Mintaka"],
      ["Mintaka", "Alnilam"],
      ["Alnilam", "Alnitak"],
      ["Alnitak", "Saiph"],
      ["Saiph", "Rigel"],
      ["Rigel", "Mintaka"],
      ["Betelgeuse", "Alnitak"],
    ],
  },
  {
    id: "summer-triangle",
    name: "The Summer Triangle",
    blurb:
      "Not an official constellation, but a giant triangle made from three of the brightest stars in the sky — Vega, Deneb, and Altair — each the brightest star of its own constellation.",
    stars: ["Vega", "Deneb", "Altair"],
    lines: [
      ["Vega", "Deneb"],
      ["Deneb", "Altair"],
      ["Altair", "Vega"],
    ],
  },
];
