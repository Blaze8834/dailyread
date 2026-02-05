export const ROUTES = [
  "curl",
  "drag",
  "slant",
  "corner",
  "streak",
  "out",
  "post",
  "flat",
  "wheel",
  "swing_left",
  "swing_right",
  "seam",
  "stop_n_go",
  "jerk",
  "double_out",
  "angle",
  "sail",
  "pivot",
  "sluggo",
  "chair",
  "block",
  "check_release",
];

export const FORMATIONS = {
  t: ["tight", "strong", "weak"],
  i: ["pro", "power", "weak"],
  pro: ["split", "slot", "tight"],
  singleback: ["ace", "trips", "doubles"],
  wing: ["right", "left", "stack"],
  "double wing": ["tight", "wide"],
  gun: ["trips", "doubles", "bunch", "empty"],
  pistol: ["base", "slot", "trips", "empty"],
  tandem: ["slot", "wide"],
};

export const FORMATION_TAGS = ["bunch", "x", "nasty"];

const BASE_COVERAGES = ["0", "1", "2", "3", "4", "6", "9"];

const COVERAGE_MODIFIERS = [
  "press",
  "off man",
  "silver shoot pinch",
  "safety blitz",
  "hole",
  "buzz",
  "rat",
  "double",
  "willie bracket",
  "spy",
  "tampa",
  "high",
  "drop",
  "hard flat",
  "man",
  "cloud",
  "lb blitz",
  "cb zone blitz",
  "show 2",
  "show 4",
  "hard",
  "quarters",
  "flat",
  "match",
  "show",
];

const COVERAGE_STACKS = [
  "press",
  "off man",
  "spy",
  "blitz",
  "show",
  "cloud",
  "drop",
  "hard flat",
  "match",
  "quarters",
];

export const COVERAGES = (() => {
  const coverages = new Set();
  BASE_COVERAGES.forEach((base) => {
    coverages.add(base);
    COVERAGE_MODIFIERS.forEach((modifier) => {
      coverages.add(`${base} ${modifier}`);
    });
    COVERAGE_STACKS.forEach((modA) => {
      COVERAGE_STACKS.forEach((modB) => {
        if (modA === modB) return;
        coverages.add(`${base} ${modA} ${modB}`);
      });
    });
  });
  return Array.from(coverages).sort();
})();

export function routePoints(route, start) {
  const { x, y } = start;
  const up = -120;
  switch (route) {
    case "curl":
      return [
        { x, y },
        { x, y: y + up },
        { x: x - 10, y: y + up + 20 },
      ];
    case "drag":
      return [
        { x, y },
        { x: x + 80, y: y - 40 },
        { x: x + 160, y: y - 50 },
      ];
    case "slant":
      return [
        { x, y },
        { x: x + 80, y: y + up + 20 },
        { x: x + 140, y: y + up + 40 },
      ];
    case "corner":
      return [
        { x, y },
        { x, y: y + up + 20 },
        { x: x + 120, y: y + up - 40 },
      ];
    case "streak":
      return [
        { x, y },
        { x, y: y + up - 80 },
        { x, y: y + up - 180 },
      ];
    case "out":
      return [
        { x, y },
        { x, y: y + up },
        { x: x + 120, y: y + up },
      ];
    case "post":
      return [
        { x, y },
        { x, y: y + up - 20 },
        { x: x + 80, y: y + up - 120 },
      ];
    case "flat":
      return [
        { x, y },
        { x: x + 90, y: y - 10 },
      ];
    case "wheel":
      return [
        { x, y },
        { x: x + 60, y: y - 40 },
        { x: x + 100, y: y + up - 120 },
      ];
    case "swing_left":
      return [
        { x, y },
        { x: x - 90, y: y - 20 },
      ];
    case "swing_right":
      return [
        { x, y },
        { x: x + 90, y: y - 20 },
      ];
    case "seam":
      return [
        { x, y },
        { x: x + 20, y: y + up - 120 },
      ];
    case "stop_n_go":
      return [
        { x, y },
        { x, y: y + up + 10 },
        { x, y: y + up - 120 },
      ];
    case "jerk":
      return [
        { x, y },
        { x: x + 50, y: y - 40 },
        { x: x - 10, y: y - 60 },
      ];
    case "double_out":
      return [
        { x, y },
        { x, y: y + up },
        { x: x + 60, y: y + up },
        { x: x + 120, y: y + up - 20 },
      ];
    case "angle":
      return [
        { x, y },
        { x: x + 30, y: y - 30 },
        { x: x + 90, y: y + up + 20 },
      ];
    case "sail":
      return [
        { x, y },
        { x: x + 40, y: y + up - 10 },
        { x: x + 140, y: y + up - 40 },
      ];
    case "pivot":
      return [
        { x, y },
        { x: x + 50, y: y - 30 },
        { x: x - 40, y: y - 20 },
      ];
    case "sluggo":
      return [
        { x, y },
        { x: x + 60, y: y + up + 20 },
        { x: x + 120, y: y + up - 120 },
      ];
    case "chair":
      return [
        { x, y },
        { x: x + 40, y: y - 20 },
        { x: x + 80, y: y + up - 120 },
      ];
    case "block":
      return [
        { x, y },
        { x, y: y - 10 },
      ];
    case "check_release":
      return [
        { x, y },
        { x, y: y - 20 },
        { x: x + 40, y: y - 60 },
      ];
    default:
      return [{ x, y }, { x, y: y + up }];
  }
}
