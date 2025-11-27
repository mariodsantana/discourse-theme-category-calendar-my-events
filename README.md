# Category Calendar — All | My Toggle (Discourse theme component)

Adds a compact segmented "ALL | MY" toggle to category pages where the Discourse Calendar plugin shows a calendar.
- Inserts control into the `.list-controls` area of category pages configured for the calendar.
- Toggles between all events and events the current user is attending (implemented by adding `attending_user` to the calendar API requests).
- Uses localStorage per-category to remember the setting.

Installation
1. Admin → Customize → Themes → Install → Import from GitHub
2. Enter the repository path or URL
3. Enable the component in your active theme (or directly add the JS asset path).
4. Open a calendar-enabled category.

Notes
- The toggle uses a page reload to force the calendar to refetch events. If you prefer a no-reload UX, I'm considering a small plugin change to the calendar component that supports a `mine` flag.
- The script/JS targets Discourse >= 3.x and Ember 6.x APIs.

License
MIT — see `LICENSE`.
