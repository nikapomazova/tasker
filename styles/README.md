# Style guide

The browser loads these files in the order shown below. Some later rules intentionally refine earlier ones.

1. `base.css` - color variables, typography, page header, and the main layout.
2. `quests.css` - egg progress, quest cards, timers, and the Duration dropdown.
3. `quest-windows.css` - quest dialogs, Group dropdown, schedules, and quest history.
4. `taskers.css` - playground, platforms, creature parts, and movement poses.
5. `collection-windows.css` - hatch/merge dialogs, Taskerdex cards, and toast messages.
6. `motion-responsive.css` - animations, mobile layout, and reduced-motion accessibility.

Group and Duration menus use different positioning because Duration must be outside the quest dialog's scrolling area. Their shared typography rules remain in `quest-windows.css`, after both individual menu styles have loaded.
