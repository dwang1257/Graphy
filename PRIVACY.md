# Privacy Policy for Graphy

Last updated: October 7, 2026

Graphy is a Chrome extension that draws LeetCode custom test cases as graphs.
It is made by Dylan Wang (`dwang2022@gmail.com`).

Graphy does not have its own servers and does not sell user data.
The only data Graphy sends anywhere other than LeetCode is a suggestion you choose to send from the panel, which goes to the developer through Google Forms.

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
The one exception is the problem slug, which is included when you send a suggestion (see [Suggestions](#suggestions)).
Graphy does not send your code, test cases, or Run results anywhere except LeetCode.

## Python Run tracer

When you click **Run** on a Python3 solution while the Graphy panel is open, Graphy may append a tracer to the request LeetCode's judge receives.
That tracer prints `#graphy` lines so the panel can animate the walk.

- The text in the editor is not changed.
- Graphy removes the `#graphy` lines from the result before LeetCode shows it, so your output looks the same as without the tracer.
- The tracer is only for visualization.
- Graphy does not send that request anywhere except LeetCode, which already receives your Run.

## Suggestions

The lightbulb button in the panel's title bar opens a form where you can send the developer a suggestion or bug report.
Nothing is sent unless you press **Send**.

When you press **Send**, Graphy sends the following to a Google Form owned by the developer:

- The text you typed
- The kind you picked (Feature, Bug, Speed, or Other), if you picked one
- The Graphy version number
- The slug of the LeetCode problem you have open, such as `two-sum`

The version and problem slug are added automatically so the developer can reproduce issues.
Graphy does not include your code, test cases, name, email address, LeetCode account, or any other identifier.
Google receives the request and standard request metadata such as your IP address, which Google handles under [Google’s Privacy Policy](https://policies.google.com/privacy).

Your draft is kept only in memory while the panel is open and is not saved to storage.
Responses are used only to improve Graphy and are not sold or shared.
To ask for a response to be deleted, email `dwang2022@gmail.com` with roughly when you sent it and what it said.

## What Graphy stores

Graphy uses Chrome’s `storage` permission:

- **Sync storage:** colors, layout, auto-open, whether you hid the review button, and similar preferences, so they can follow your Chrome profile across devices if you are signed in.
- **Local storage:** panel position/size, the structure type you pick for a problem (stored by problem slug), and optional background or node images you choose. Images stay on the device because they are too large for sync.

Uninstalling Graphy removes this stored data.

## What Graphy does not collect

Graphy does not:

- Create an account or ask for your name or email address
- Use analytics, advertising, or crash-reporting services
- Sell or rent data
- Transfer data to third parties for their own use
- Send anything to the developer unless you press **Send** on a suggestion

## Third-party services

- **LeetCode** receives your code and Run requests as it normally would. Graphy's Python tracer, when used, is part of that same Run request. When a problem's test cases are not already in the page, Graphy asks LeetCode's GraphQL API for them using your existing LeetCode session, the same way the LeetCode page does.
- **Google Forms** receives suggestions you choose to send, as described in [Suggestions](#suggestions). The form and its responses are owned by the developer.
- **Fonts** ship inside the extension. Graphy makes no font requests to Google Fonts or any other third party.

Google’s handling of Chrome sync data and Google Forms requests is covered by [Google’s Privacy Policy](https://policies.google.com/privacy).

## Children

Graphy is not directed at children under 13.

## Changes

If this policy changes, the date at the top of this page will be updated.

## Contact

Dylan Wang  
dwang2022@gmail.com  
https://github.com/dwang1257/Graphy
