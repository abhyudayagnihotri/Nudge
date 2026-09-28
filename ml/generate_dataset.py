"""
Phase 9: Behavioral Telemetry Dataset Generator for Nudge.

Generates realistic behavioral sessions modeling:
1. Deep Work & Focused Research
2. Intentional Media & Entertainment
3. Compulsive Doomscrolling & Infinite Scroll Traps
"""

import json
import os
import random
import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

NUM_SAMPLES = 2500

records = []

for i in range(NUM_SAMPLES):
    # Determine cohort
    cohort = random.choices(["work", "intentional_media", "doomscroll"], weights=[0.35, 0.30, 0.35])[0]

    if cohort == "work":
        # Focused research / coding / reading
        duration = float(np.random.uniform(5.0, 45.0))
        scroll_velocity = float(np.random.normal(0.65, 0.2))
        scroll_velocity = max(0.2, min(1.2, scroll_velocity))
        max_velocity = float(scroll_velocity * np.random.uniform(1.3, 2.2))
        scroll_frequency = float(np.random.uniform(2.0, 8.0))
        distance_rate = float(scroll_frequency * np.random.uniform(150.0, 450.0))
        activity_density = float(scroll_frequency + np.random.uniform(8.0, 25.0))
        tab_frequency = float(np.random.uniform(0.5, 3.5))
        autoplay_ratio = 0.0
        video_rate = float(np.random.choice([0.0, 0.05, 0.1], p=[0.8, 0.15, 0.05]))
        hour = int(random.choices(range(24), weights=[1]*7 + [4]*12 + [2]*5)[0])
        late_night = 1 if (hour >= 23 or hour < 5) else 0
        infinite_ratio = float(np.random.uniform(0.0, 0.1))
        repetition_index = float(np.random.uniform(0.05, 0.3))
        is_doomscroll = 0
        compulsion_score = float(np.random.uniform(0.02, 0.25))

    elif cohort == "intentional_media":
        # Watching video or educational content deliberately
        duration = float(np.random.uniform(10.0, 50.0))
        scroll_velocity = float(np.random.normal(0.85, 0.25))
        scroll_velocity = max(0.3, min(1.5, scroll_velocity))
        max_velocity = float(scroll_velocity * np.random.uniform(1.4, 2.5))
        scroll_frequency = float(np.random.uniform(3.0, 10.0))
        distance_rate = float(scroll_frequency * np.random.uniform(250.0, 600.0))
        activity_density = float(scroll_frequency + np.random.uniform(4.0, 15.0))
        tab_frequency = float(np.random.uniform(0.2, 2.0))
        autoplay_ratio = float(np.random.uniform(0.0, 0.25))
        video_rate = float(np.random.uniform(0.1, 0.4))
        hour = int(random.choices(range(24), weights=[1]*7 + [3]*9 + [5]*6 + [2]*2)[0])
        late_night = 1 if (hour >= 23 or hour < 5) else 0
        infinite_ratio = float(np.random.uniform(0.1, 0.4))
        repetition_index = float(np.random.uniform(0.15, 0.45))
        is_doomscroll = 0
        compulsion_score = float(np.random.uniform(0.15, 0.48))

    else:
        # Compulsive Doomscrolling loop
        duration = float(np.random.uniform(25.0, 90.0))
        scroll_velocity = float(np.random.normal(2.4, 0.6))
        scroll_velocity = max(1.5, min(5.0, scroll_velocity))
        max_velocity = float(scroll_velocity * np.random.uniform(1.8, 3.2))
        scroll_frequency = float(np.random.uniform(14.0, 42.0))
        distance_rate = float(scroll_frequency * np.random.uniform(600.0, 1800.0))
        activity_density = float(scroll_frequency + np.random.uniform(15.0, 45.0))
        tab_frequency = float(np.random.uniform(3.0, 12.0))
        autoplay_ratio = float(np.random.uniform(0.55, 1.0))
        video_rate = float(np.random.uniform(0.5, 3.0))
        hour = int(random.choices(range(24), weights=[6]*6 + [1]*12 + [5]*6)[0])
        late_night = 1 if (hour >= 23 or hour < 5) else 0
        infinite_ratio = float(np.random.uniform(0.6, 1.0))
        repetition_index = float(np.random.uniform(0.65, 1.0))
        is_doomscroll = 1
        compulsion_score = float(np.random.uniform(0.68, 0.98))

    records.append({
        "sessionId": f"synthetic_{i:04d}",
        "sessionDurationMinutes": round(duration, 2),
        "scrollFrequency": round(scroll_frequency, 2),
        "averageScrollVelocity": round(scroll_velocity, 3),
        "maxScrollVelocity": round(max_velocity, 3),
        "scrollDistanceRate": round(distance_rate, 1),
        "activityDensity": round(activity_density, 2),
        "tabSwitchFrequency": round(tab_frequency, 2),
        "autoplayRatio": round(autoplay_ratio, 3),
        "videoConsumptionRate": round(video_rate, 2),
        "timeOfDayHour": hour,
        "isLateNight": late_night,
        "infiniteScrollDomainRatio": round(infinite_ratio, 3),
        "compulsionRepetitionIndex": round(repetition_index, 3),
        "compulsionScore": round(compulsion_score, 3),
        "is_doomscroll": is_doomscroll,
        "cohort": cohort
    })

df = pd.DataFrame(records)
csv_path = os.path.join(OUTPUT_DIR, "nudge_dataset.csv")
json_path = os.path.join(OUTPUT_DIR, "nudge_dataset.json")

df.to_csv(csv_path, index=False)
with open(json_path, "w") as f:
    json.dump(records, f, indent=2)

print(f"Generated {len(df)} samples.")
print(f"Doomscroll class distribution:\n{df['is_doomscroll'].value_counts(normalize=True)}")
print(f"Saved dataset to {csv_path} and {json_path}")
