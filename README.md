# last-save-leonida

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/palzzzzz/last-save-leonida/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/palzzzzz/last-save-leonida/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

LAST SAVE is an offline web app that tracks all 55 official PS5 trophies for Grand Theft Auto VI. It offers a visual missable timeline (with the Chapter 1 point of no return), per-chapter spoiler protection, a checkable meditation spot grid for Positive Mental Attitude, per-trophy guides written in our own words with cited sources, and an audit view with confidence badges. Progress is stored in localStorage with export/import. Unofficial fan guide, not affiliated with Rockstar Games or Sony.

## What's inside

- **Missable timeline**: a visual strip showing which trophies you can lose for good, anchored on the Chapter 1 point of no return.
- **Meditation spot grid**: tick off each location as you find it on the way to Positive Mental Attitude.
- **Spoiler chapters**: guides stay hidden per chapter until you choose to reveal them.
- **Trophy guides**: numbered steps in our own words, each tied to a numbered source marker.
- **Audit matrix and conflicts**: every claim gets a confidence badge, and disagreements between sources are listed side by side.
- **Export/import**: your progress lives in localStorage and can be saved to a file and restored.

## Run it

Any static server works, e.g.:

```sh
python3 -m http.server 8000 --directory app
# then open http://localhost:8000
```

Or open `app/index.html` directly. It is fully offline and works from `file://`.

<sub>Entered on [make.fun](https://make.fun/?ref=n05t7x5q&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
