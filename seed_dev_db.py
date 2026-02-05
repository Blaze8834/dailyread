from models import init_db, seed_play

SAMPLE_PLAY = {
    "id": 1,
    "name": "Sample Play: Trips Right Slant",
    "canvas": {"width": 1200, "height": 530},
    "entities": [
        {
            "id": "wr1",
            "type": "player",
            "label": "WR1",
            "x": 260,
            "y": 160,
            "radius": 12,
            "color": "#1d4ed8",
            "behavior": "static",
        },
        {
            "id": "wr2",
            "type": "player",
            "label": "WR2",
            "x": 260,
            "y": 265,
            "radius": 12,
            "color": "#1d4ed8",
            "behavior": "static",
        },
        {
            "id": "wr3",
            "type": "player",
            "label": "WR3",
            "x": 260,
            "y": 370,
            "radius": 12,
            "color": "#1d4ed8",
            "behavior": "static",
        },
        {
            "id": "qb",
            "type": "player",
            "label": "QB",
            "x": 210,
            "y": 265,
            "radius": 12,
            "color": "#1d4ed8",
            "behavior": "controlled",
        },
        {
            "id": "rb",
            "type": "player",
            "label": "RB",
            "x": 210,
            "y": 330,
            "radius": 11,
            "color": "#1d4ed8",
            "behavior": "static",
        },
        {
            "id": "cb1",
            "type": "npc",
            "label": "CB1",
            "x": 340,
            "y": 160,
            "radius": 12,
            "color": "#dc2626",
            "behavior": {"type": "follow", "target": "wr1", "speed": 70},
        },
        {
            "id": "lb",
            "type": "npc",
            "label": "LB",
            "x": 420,
            "y": 265,
            "radius": 13,
            "color": "#dc2626",
            "behavior": {"type": "patrol", "path": [{"x": 420, "y": 220}, {"x": 420, "y": 310}], "speed": 40},
        },
        {
            "id": "s1",
            "type": "npc",
            "label": "S",
            "x": 520,
            "y": 200,
            "radius": 13,
            "color": "#dc2626",
            "behavior": "static",
        },
        {
            "id": "endzone",
            "type": "target",
            "label": "EZ",
            "x": 1080,
            "y": 265,
            "radius": 55,
            "color": "#22c55e",
            "behavior": "static",
        },
    ],
    "routes": [
        {
            "id": "SLANT",
            "name": "Slant",
            "points": [
                {"x": 260, "y": 160},
                {"x": 420, "y": 210},
                {"x": 640, "y": 260},
                {"x": 820, "y": 265},
            ],
            "color": "#f59e0b",
        },
        {
            "id": "GO",
            "name": "Go",
            "points": [
                {"x": 260, "y": 160},
                {"x": 460, "y": 140},
                {"x": 740, "y": 120},
                {"x": 1020, "y": 100},
            ],
            "color": "#38bdf8",
        },
        {
            "id": "OUT",
            "name": "Out",
            "points": [
                {"x": 260, "y": 160},
                {"x": 520, "y": 160},
                {"x": 740, "y": 120},
            ],
            "color": "#a78bfa",
        },
    ],
    "objectives": [
        {
            "id": "o1",
            "type": "reach_zone",
            "params": {"x": 1080, "y": 265, "radius": 55, "time_limit": 12},
        },
        {"id": "o2", "type": "avoid_collision", "params": {}},
    ],
}


if __name__ == "__main__":
    init_db()
    seed_play(SAMPLE_PLAY)
    print("Seeded play to dailyread.db")
