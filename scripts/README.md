# JavaScript guide

The scripts load in this order:

1. `physics.js` - reusable gravity, collision, slope, and platform calculations.
2. `core.js` - configuration, DOM references, saved-state migration, and shared helpers.
3. `quests.js` - tasks, timers, groups, durations, egg progress, and quest dialogs.
4. `collection.js` - randomized Taskers, Taskerdex rendering, hatching, and merging.
5. `playground.js` - drawn platforms, dragging, autonomous movement, and reactions.
6. `startup.js` - restores the garden, begins animation, and starts periodic updates.

Code in later files can use declarations from earlier files.