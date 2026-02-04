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

FORMATIONS = {
    "t": ["tight", "strong", "weak"],
    "i": ["pro", "power", "weak"],
    "pro": ["split", "slot", "tight"],
    "singleback": ["ace", "trips", "doubles"],
    "wing": ["right", "left", "stack"],
    "double wing": ["tight", "wide"],
    "gun": ["trips", "doubles", "bunch"],
    "pistol": ["base", "slot", "trips"],
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
                coverages.append(f\"{base} {modifier_a} {modifier_b}\")
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
    base_y = 360
    if "gun" in formation:
        qb_y = 420
        rb_y = 470
    else:
        qb_y = 440
        rb_y = 480

    positions = {
        "qb": (50, qb_y),
        "rb": (40, rb_y),
        "wr1": (60, base_y - 120),
        "wr2": (60, base_y - 200),
        "wr3": (60, base_y - 280),
        "te": (60, base_y - 40),
    }
    if "trips" in formation:
        positions["wr1"] = (60, base_y - 140)
        positions["wr2"] = (60, base_y - 210)
        positions["wr3"] = (60, base_y - 280)
    if tag == "bunch":
        positions["wr1"] = (80, base_y - 200)
        positions["wr2"] = (90, base_y - 220)
        positions["wr3"] = (100, base_y - 180)
    if tag == "nasty":
        positions["wr1"] = (60, base_y - 180)
        positions["wr2"] = (60, base_y - 240)
        positions["wr3"] = (60, base_y - 300)
    return positions


def defense_shell(coverage: str) -> Dict[str, Tuple[float, float]]:
    coverage_num = coverage.split()[0]
    shell_y = 200
    if coverage_num in {"0", "1"}:
        shell_y = 260
    elif coverage_num in {"2", "3"}:
        shell_y = 220
    elif coverage_num in {"4", "6", "9"}:
        shell_y = 180

    defenders = {
        "cb1": (220, 140),
        "cb2": (220, 260),
        "lb1": (200, 260),
        "lb2": (200, 300),
        "lb3": (200, 200),
        "ss": (260, shell_y),
        "fs": (260, shell_y + 60),
        "de1": (140, 120),
        "dt1": (140, 170),
        "dt2": (140, 220),
        "de2": (140, 270),
    }
    if "press" in coverage:
        defenders["cb1"] = (140, 170)
        defenders["cb2"] = (140, 330)
    if "blitz" in coverage:
        defenders["lb1"] = (170, 220)
        defenders["lb2"] = (170, 280)
    return defenders


def build_play(play_name: str, seed: int, config: PlayConfig) -> Dict[str, any]:
    offense_positions = formation_layout(config.formation, config.formation_tag)
    defense_positions = defense_shell(config.coverage)

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

    return {
        "id": seed,
        "name": play_name,
        "canvas": {"width": 900, "height": 600},
        "formation": config.formation,
        "formation_tag": config.formation_tag,
        "coverage": config.coverage,
        "entities": entities,
        "routes": routes,
        "objectives": [
            {"id": "o1", "type": "score", "params": {"time_limit": 6}},
        ],
    }


def score_attempt(events: List[Dict[str, any]], read_correct: bool) -> float:
    score = 0
    score += 350 if read_correct else 150
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
