import hashlib
import math
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

OFFENSE_COLOR = "#1d4ed8"
DEFENSE_COLOR = "#dc2626"
QB_COLOR = "#facc15"

ROUTES = [
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
]

PRIMARY_ROUTES = ["post", "sluggo", "corner", "streak", "sail"]
SECONDARY_ROUTES = ["slant", "out", "pivot", "drag", "seam", "curl"]
MOTION_ROUTES = ["wheel", "flat", "swing_left", "swing_right", "drag"]
CHECK_RELEASE_ROUTES = ["check_release", "block", "angle", "flat"]

FORMATIONS = {
    "t": ["tight", "strong", "weak"],
    "i": ["pro", "power", "weak"],
    "pro": ["split", "slot", "tight"],
    "singleback": ["ace", "trips", "doubles"],
    "wing": ["right", "left", "stack"],
    "double wing": ["tight", "wide"],
    "gun": ["trips", "doubles", "bunch", "empty"],
    "pistol": ["base", "slot", "trips", "empty"],
    "tandem": ["slot", "wide"],
}

FORMATION_TAGS = ["bunch", "x", "nasty"]

BASE_COVERAGES = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "6",
    "9",
]

COVERAGE_MODIFIERS = [
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
]

COVERAGE_STACKS = [
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
]


def build_coverages() -> List[str]:
    coverages = []
    for base in BASE_COVERAGES:
        coverages.append(base)
        for modifier in COVERAGE_MODIFIERS:
            coverages.append(f"{base} {modifier}")
        for modifier_a in COVERAGE_STACKS:
            for modifier_b in COVERAGE_STACKS:
                if modifier_a == modifier_b:
                    continue
                coverages.append(f"{base} {modifier_a} {modifier_b}")
    return sorted(set(coverages))


COVERAGES = build_coverages()


@dataclass
class RNG:
    seed: int

    def rand(self) -> float:
        self.seed = (1664525 * self.seed + 1013904223) % 2**32
        return self.seed / 2**32

    def choice(self, items: List[str]) -> str:
        idx = int(self.rand() * len(items))
        return items[idx % len(items)]


@dataclass
class PlayConfig:
    name: str
    formation: str
    formation_tag: str
    coverage: str
    seed: int


def seed_for_today() -> int:
    try:
        tz = ZoneInfo("America/New_York")
        now = datetime.now(tz)
    except ZoneInfoNotFoundError:
        now = datetime.utcnow()
    date_key = now.strftime("%Y-%m-%d")
    return int(hashlib.sha256(date_key.encode()).hexdigest(), 16) % (2**32)


def seed_from_name(play_name: str) -> int:
    return int(hashlib.sha256(play_name.encode()).hexdigest(), 16) % (2**32)


def generate_play_name(seed: int) -> PlayConfig:
    rng = RNG(seed)
    formation = rng.choice(list(FORMATIONS.keys()))
    subset = rng.choice(FORMATIONS[formation])
    tag = rng.choice(FORMATION_TAGS)
    coverage = rng.choice(COVERAGES)
    name = f"Daily Read {formation.title()} {subset.title()} {tag.title()} vs {coverage.title()}"
    return PlayConfig(name=name, formation=f"{formation} {subset}", formation_tag=tag, coverage=coverage, seed=seed)


def formation_layout(formation: str, tag: str) -> Dict[str, Tuple[float, float]]:
    center_x = 450
    qb_y = 520
    positions = {
        "qb": (center_x, qb_y),
        "wr1": (center_x - 220, 435),
        "wr2": (center_x, 415),
        "wr3": (center_x + 220, 435),
        "te": (center_x + 70, 490),
        "rb": (center_x - 70, 500),
    }

    is_empty = "empty" in formation
    if is_empty:
        positions["rb"] = (center_x + 300, 430)

    if "trips" in formation:
        positions["wr1"] = (center_x + 120, 430)
        positions["wr2"] = (center_x + 220, 420)
        positions["wr3"] = (center_x + 320, 410)
    if tag == "bunch":
        positions["wr1"] = (center_x + 120, 445)
        positions["wr2"] = (center_x + 145, 430)
        positions["wr3"] = (center_x + 170, 415)
    if tag == "nasty":
        positions["wr1"] = (center_x - 120, 450)
        positions["wr2"] = (center_x - 60, 425)
        positions["wr3"] = (center_x, 410)

    positions["te"] = (center_x + 70, qb_y - 25)
    if not is_empty:
        positions["rb"] = (center_x - 70, qb_y - 10)
    return positions


def defense_shell(coverage: str, offense_positions: Dict[str, Tuple[float, float]]) -> Dict[str, Tuple[float, float]]:
    coverage_num = coverage.split()[0]
    shell_y = 185
    if coverage_num in {"0", "1"}:
        shell_y = 225
    elif coverage_num in {"2", "3"}:
        shell_y = 200
    elif coverage_num in {"4", "6", "9"}:
        shell_y = 165

    wr1_x, wr1_y = offense_positions["wr1"]
    wr2_x, wr2_y = offense_positions["wr2"]
    wr3_x, wr3_y = offense_positions["wr3"]
    te_x, te_y = offense_positions["te"]
    rb_x, rb_y = offense_positions["rb"]
    qb_x, qb_y = offense_positions["qb"]

    defenders = {
        "cb1": (wr1_x, max(80, wr1_y - 130)),
        "cb2": (wr2_x, max(80, wr2_y - 130)),
        "nb": (wr3_x, max(80, wr3_y - 130)),
        "lb1": (te_x, max(120, te_y - 120)),
        "lb2": (qb_x - 40, max(120, qb_y - 150)),
        "lb3": (rb_x, max(120, rb_y - 130)),
        "ss": (qb_x - 90, shell_y),
        "fs": (qb_x + 90, shell_y),
        "de1": (qb_x - 120, qb_y - 105),
        "dt1": (qb_x - 40, qb_y - 120),
        "dt2": (qb_x + 40, qb_y - 120),
        "de2": (qb_x + 120, qb_y - 105),
    }
    if "press" in coverage:
        defenders["cb1"] = (wr1_x, wr1_y - 30)
        defenders["cb2"] = (wr2_x, wr2_y - 30)
        defenders["nb"] = (wr3_x, wr3_y - 30)
    if "blitz" in coverage:
        defenders["lb1"] = (qb_x - 30, qb_y - 80)
        defenders["lb2"] = (qb_x + 20, qb_y - 85)
    return defenders


def build_play(play_name: str, seed: int, config: PlayConfig) -> Dict[str, any]:
    offense_positions = formation_layout(config.formation, config.formation_tag)
    defense_positions = defense_shell(config.coverage, offense_positions)

    entities = []
    for name, (x, y) in offense_positions.items():
        color = QB_COLOR if name == "qb" else OFFENSE_COLOR
        entities.append(
            {
                "id": name,
                "type": "player",
                "label": name.upper(),
                "x": x,
                "y": y,
                "radius": 12,
                "color": color,
                "behavior": "controlled" if name == "qb" else "static",
            }
        )

    for name, (x, y) in defense_positions.items():
        entities.append(
            {
                "id": name,
                "type": "npc",
                "label": name.upper(),
                "x": x,
                "y": y,
                "radius": 12,
                "color": DEFENSE_COLOR,
                "behavior": {
                    "type": "defense",
                    "coverage": config.coverage,
                    "role": name,
                },
            }
        )

    palette = ["#38bdf8", "#f59e0b", "#a78bfa", "#22c55e", "#f472b6", "#fb7185"]
    routes = [
        {
            "id": route.upper(),
            "name": route.title().replace("_", " "),
            "points": [],
            "color": palette[idx % len(palette)],
        }
        for idx, route in enumerate(ROUTES)
    ]

    rng = RNG(seed ^ 0xABCDEF)
    base_plan = [
        {
            "receiver_id": "wr1",
            "route_id": rng.choice(PRIMARY_ROUTES).upper(),
            "role": "primary",
        },
        {
            "receiver_id": "wr2",
            "route_id": rng.choice(SECONDARY_ROUTES).upper().replace(" ", "_"),
            "role": "secondary",
        },
        {
            "receiver_id": "wr3",
            "route_id": rng.choice(SECONDARY_ROUTES).upper().replace(" ", "_"),
            "role": "secondary",
        },
        {
            "receiver_id": "te",
            "route_id": rng.choice(MOTION_ROUTES).upper().replace(" ", "_"),
            "role": "motion",
        },
        {
            "receiver_id": "rb",
            "route_id": rng.choice(CHECK_RELEASE_ROUTES).upper().replace(" ", "_"),
            "role": "check_release",
        },
    ]

    return {
        "id": seed,
        "name": play_name,
        "canvas": {"width": 900, "height": 600},
        "formation": config.formation,
        "formation_tag": config.formation_tag,
        "coverage": config.coverage,
        "entities": entities,
        "routes": routes,
        "base_plan": base_plan,
        "route_role_colors": {
            "primary": "#ef4444",
            "secondary": "#facc15",
            "motion": "#3b82f6",
            "check_release": "#a855f7",
        },
        "objectives": [
            {"id": "o1", "type": "score", "params": {"time_limit": 6}},
        ],
    }


def score_attempt(events: List[Dict[str, any]]) -> float:
    score = 0
    score += 200
    complete = any(event.get("type") == "complete" for event in events)
    intercepted = any(event.get("type") == "interception" for event in events)
    pressured = any(event.get("type") == "sack" for event in events)
    if complete:
        score += 400
    if intercepted:
        score -= 350
    if pressured:
        score -= 150
    separation = 0
    for event in events:
        if event.get("type") == "target":
            separation = max(separation, float(event.get("payload", {}).get("separation", 0)))
    score += min(200, separation * 40)
    return max(0, min(1000, round(score, 2)))
