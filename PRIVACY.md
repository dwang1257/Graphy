# Privacy Policy for Graphy

Last updated: October 2, 2026

Graphy is a Chrome extension that draws LeetCode custom test cases as graphs.
It is made by Dylan Wang (`dwang2022@gmail.com`).

Graphy does not have its own servers and does not sell or share user data.

Graphy shows a concise data-use notice in the panel the first time it loads.
You can dismiss that notice, and the dismissal is stored locally in Chrome storage.

## Where Graphy runs

Graphy's content script loads on pages at:

- [leetcode.com](https://leetcode.com)
- [leetcode.cn](https://leetcode.cn)

It only opens its panel and reads page data on problem pages (`/problems/...`).
It does not run on other websites.

## What Graphy reads

On those pages, Graphy reads the following in your browser so it can draw and update the graph:

- The problem slug from the page URL
- The problem's example test cases, from the page data or from LeetCode's own GraphQL API
- The solution in the editor
- Custom test cases, including edits LeetCode keeps in the page's session storage
- Language selection, including LeetCode's saved language preference in the page's local storage
- Run requests and results from LeetCode's judge (stdout used for playback)

To read Run requests and results, Graphy watches the page's network requests to LeetCode's Run and result endpoints.
It ignores all other requests.

This information stays in the browser.
Graphy does not send it to a Graphy server because Graphy does not operate one.

## Python Run tracer

When you click **Run** on a Python3 solution while the Graphy panel is open, Graphy may append a tracer to the request LeetCode's judge receives.
That tracer prints `#graphy` lines so the panel can animate the walk.

- The text in the editor is not changed.
- Graphy removes the `#graphy` lines from the result before LeetCode shows it, so your output looks the same as without the tracer.
- The tracer is only for visualization.
- Graphy does not send that request anywhere except LeetCode, which already receives your Run.

## What Graphy stores

Graphy uses Chrome’s `storage` permission:

- **Sync storage:** colors, layout, auto-open, and similar preferences, so they can follow your Chrome profile across devices if you are signed in.
- **Local storage:** panel position/size, the structure type you pick for a problem (stored by problem slug), and optional background or node images you choose. Images stay on the device because they are too large for sync.
- **Local storage:** the one-time dismissal of Graphy's in-panel privacy notice.

Uninstalling Graphy removes this stored data.

## What Graphy does not collect

Graphy does not:

- Create an account
- Use analytics, advertising, or crash-reporting services
- Sell or rent data
- Transfer data to third parties for their own use

## Third-party services

- **LeetCode** receives your code and Run requests as it normally would. Graphy's Python tracer, when used, is part of that same Run request. When a problem's test cases are not already in the page, Graphy asks LeetCode's GraphQL API for them using your existing LeetCode session, the same way the LeetCode page does.
- **Fonts** ship inside the extension. Graphy makes no font requests to Google Fonts or any other third party.

Google’s handling of Chrome sync data is covered by [Google’s Privacy Policy](https://policies.google.com/privacy).

## Children

Graphy is not directed at children under 13.

## Changes

If this policy changes, the date at the top of this page will be updated.

## Contact

Dylan Wang  
dwang2022@gmail.com  
https://github.com/dwang1257/Graphy
