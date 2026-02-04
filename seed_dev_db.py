from models import init_db, seed_play

SAMPLE_PLAY = {
    "id": 1,
    "name": "Sample Play: Crossfield",
    "canvas": {"width": 800, "height": 600},
    "entities": [
        {
            "id": "p1",
            "type": "player",
            "x": 100,
            "y": 300,
            "radius": 12,
            "color": "#0b5fff",
            "behavior": "controlled",
        },
        {
            "id": "n1",
            "type": "npc",
            "x": 400,
            "y": 200,
            "radius": 14,
            "color": "#ff6b6b",
            "behavior": {
                "type": "patrol",
                "path": [
                    {"x": 350, "y": 150},
                    {"x": 450, "y": 150},
                    {"x": 450, "y": 250},
                    {"x": 350, "y": 250},
                ],
                "speed": 40,
            },
        },
        {
            "id": "t1",
            "type": "target",
            "x": 700,
            "y": 300,
            "radius": 30,
            "color": "#2ecc71",
            "behavior": "static",
        },
    ],
    "routes": [
        {
            "id": "A",
            "name": "Route A",
            "points": [
                {"x": 120, "y": 300},
                {"x": 300, "y": 250},
                {"x": 500, "y": 300},
                {"x": 700, "y": 300},
            ],
            "color": "#ffb703",
        },
        {
            "id": "B",
            "name": "Route B",
            "points": [
                {"x": 120, "y": 300},
                {"x": 300, "y": 350},
                {"x": 500, "y": 320},
                {"x": 700, "y": 300},
            ],
            "color": "#8ecae6",
        },
    ],
    "objectives": [
        {
            "id": "o1",
            "type": "reach_zone",
            "params": {"x": 700, "y": 300, "radius": 30, "time_limit": 60},
        },
        {"id": "o2", "type": "avoid_collision", "params": {}},
    ],
}


if __name__ == "__main__":
    init_db()
    seed_play(SAMPLE_PLAY)
    print("Seeded play to dailyread.db")
