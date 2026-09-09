# Privacy Policy for Graphy

Last updated: September 8, 2026

Graphy is a Chrome extension that draws LeetCode custom test cases as graphs. It is made by Dylan Wang (`dwang2022@gmail.com`).

Graphy does not have its own servers and does not sell or share user data.

## Where Graphy runs

Graphy only runs on problem pages at:

- [leetcode.com](https://leetcode.com)
- [leetcode.cn](https://leetcode.cn)

It does not run on other websites.

## What Graphy reads

On those pages, Graphy reads the following in your browser so it can draw and update the graph:

- The problem slug from the page URL
- The solution in the editor
- Custom test cases
- Language selection
- Run output from LeetCode’s judge (stdout used for playback)

This information stays in the browser. Graphy does not upload it to a Graphy backend.

## Python Run tracer

When you click **Run** on a Python or Python3 solution, Graphy may append a local tracer to the request LeetCode’s judge receives. That tracer prints `#graphy` lines so the panel can animate the walk.

- The text in the editor is not changed.
- The tracer is only for visualization.
- Graphy does not send that request anywhere except LeetCode, which already receives your Run.

## What Graphy stores

Graphy uses Chrome’s `storage` permission:

- **Sync storage:** colors, layout, and similar preferences, so they can follow your Chrome profile across devices if you are signed in.
- **Local storage:** panel position/size and optional background or node images you choose. Images stay on the device because they are too large for sync.

Uninstalling Graphy removes this stored data.

## What Graphy does not collect

Graphy does not:

- Create an account
- Use analytics, advertising, or crash-reporting services
- Sell or rent data
- Transfer data to third parties for their own use

## Third-party services

- **LeetCode** receives your code and Run requests as it normally would. Graphy’s Python tracer, when used, is part of that same Run request.
- **Google Fonts** may load Outfit for the panel UI (`fonts.googleapis.com` / `fonts.gstatic.com`). That is a font request from the extension page, not Graphy sending your solutions to Google.

Google’s handling of Chrome sync data is covered by [Google’s Privacy Policy](https://policies.google.com/privacy).

## Children

Graphy is not directed at children under 13.

## Changes

If this policy changes, the date at the top of this page will be updated.

## Contact

Dylan Wang  
dwang2022@gmail.com  
https://github.com/dwang1257/Graphy
