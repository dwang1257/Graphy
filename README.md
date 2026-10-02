<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
<div align="center">

[![Stargazers][stars-shield]][stars-url]
[![Forks][forks-shield]][forks-url]
[![Issues][issues-shield]][issues-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

</div>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="public/icons/icon128.png" alt="Graphy logo" width="80" height="80">

  <h3 align="center">Graphy</h3>

  <p align="center">
    A highly customizable graph visualizer for LeetCode problems.
    <br />
    <br />
    <a href="#getting-started">Install</a>
    &middot;
    <a href="https://github.com/dwang1257/Graphy/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/dwang1257/Graphy/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#supported-structures">Supported Structures</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#styling">Styling</a></li>
        <li><a href="#custom-input">Custom input</a></li>
        <li><a href="#tracing">Tracing</a></li>
      </ul>
    </li>
    <li><a href="#development">Development</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Graphy is a highly customizable graph visualizer for LeetCode problems.
You can restyle the canvas, nodes, and edges as you please, and every change shows up on the graph instantly.

Graphy reads the test case straight out of the editor and renders it in a floating panel next to the problem. Currently it supports binary trees, linked lists, and graphs.

It can also show how your code runs on that drawing.
Hit **Run** and Graphy steps through your solution: the current node, the nodes you have already visited, the frontier (queue or stack), and named pointers as the algorithm moves.
Python solutions are traced automatically, and pointer rewrites, new nodes, and deletions reshape the drawing as they happen.
Other languages can print `#graphy` lines to drive the same playback.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Supported Structures

| Structure | Example input |
| --- | --- |
| Binary tree | `[3,9,20,null,null,15,7]` |
| Linked list | `[1,2,3,4]`, `pos = 1` |
| Graph | `["11110","10001"]`, `[[1,1,0],[1,1,0],[0,0,1]]` |

Graphy detects the structure of each input from the problem's signature.
Use the dropdown in the panel's title bar to override it, or pick **Auto** to go back to detection.
Problems with several structure inputs, such as Same Tree or Merge Two Sorted Lists, draw every structure side by side.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][typescript-shield]][typescript-url]
* [![Preact][preact-shield]][preact-url]
* [![Vite][vite-shield]][vite-url]
* [![Graphviz][graphviz-shield]][graphviz-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

Graphy is a Chrome extension. Install it from the [Chrome Web Store](https://chromewebstore.google.com), then open any LeetCode problem.

### Prerequisites

* Chrome, or any Chromium browser with Manifest V3 support (Edge, Arc, Brave, and similar)

### Installation

1. Open the Chrome Web Store and search for **Graphy**.
2. Click **Add to Chrome**.
3. Open a problem on [leetcode.com](https://leetcode.com) or [leetcode.cn](https://leetcode.cn). The panel appears next to the editor.

Click the Graphy icon in the toolbar to show or hide the panel.

### Privacy and data use

Graphy reads the LeetCode editor, custom testcase inputs, and Run output locally in your browser to draw and trace graphs.
Graphy stores visual settings in Chrome sync storage, and stores panel geometry, selected images, and the privacy-notice dismissal in local storage.
Graphy does not send this data to a Graphy server.
Fonts ship inside the extension, so the panel makes no requests to Google Fonts or any other third party.
See [PRIVACY.md](PRIVACY.md) for the complete policy.

<!-- USAGE -->
## Usage

### Styling

Click **Style** in the panel's title bar to open the style drawer.
Changes apply to the graph as you make them, including while you drag a color picker.

| Group | Settings |
| --- | --- |
| Theme | Light or Dark |
| Nodes | Shape, fill color, and an optional image |
| Edges | Line style, color, and arrowheads |
| Canvas | Background color and an optional image |
| Display | Null children in trees, grid indices, and the list end marker |

Colors and images are saved per theme, so Light and Dark each keep their own palette.
**Reset Light theme** (or **Reset Dark theme**) restores that theme's default colors, and **Undo reset** stays available for a few seconds afterwards.
Press **Escape** or click outside the drawer to close it.

### Custom input

Open the **Custom** tab under the graph to draw your own input.
There is one field per parameter of the problem, labelled with its name and type.
Each structure field has its own dropdown, so you can pick a structure, choose **None** to skip it, or leave it on **Auto**.
Pasting a whole LeetCode testcase, with one value per line, fills the fields in order.
Press **Enter** or **Draw** to render, and **Shift+Enter** for a new line.

### Tracing

Python solutions are traced automatically when you hit **Run**, so you do not need to change your code.
Graphy keeps its trace data out of LeetCode's stdout, so the output you see is only what your code prints.
Use the play, step, and scrubber controls under the graph to move through the run.
Very long runs are cut off, and the playback bar shows how many steps were kept.

In other languages, print lines that start with `#graphy` followed by one or more verbs and node references:

| Verb | Effect |
| --- | --- |
| `current <refs>` | Moves the current highlight |
| `visit <refs>` | Marks nodes as visited |
| `walk <refs>` | Moves the current highlight and marks each node as visited |
| `enqueue <refs>` | Adds nodes to the frontier |
| `dequeue <refs>` | Removes nodes from the frontier |
| `frontier <refs>` | Replaces the frontier |
| `clear` | Clears all highlights |

A reference is a node value such as `5`, a node id such as `a3`, or a grid cell such as `2,3`.
For example, `print("#graphy walk 1 2 4")` walks three nodes of a tree.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEVELOPMENT -->
## Development

Graphy is built with Vite and CRXJS.
Install dependencies with `npm install`, which also keeps packages in `node_modules.nosync` so iCloud does not evict them.
Run a plain `npm install` again after adding a package, because `npm install <package>` skips that step.

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the extension into `dist/` |
| `npm test` | Runs the script checks and the Vitest suite |
| `npm run typecheck` | Type-checks the extension and the harness |
| `npm run lint` | Type-checks and runs the repository lint rules |
| `npm run harness` | Serves the panel standalone at `http://localhost:5199` |

The harness renders the real panel inside a stand-in LeetCode host, with an in-memory `chrome.storage` and sample inputs for trees, lists, grids, multiple cases, and traces.
It never writes to `dist/`, so use it instead of `npm run dev` for quick visual checks.
From the browser console, `window.graphyHarness` can send samples, resize the panel, and switch themes.

To try a build in Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `dist/`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [ ] Support for more structures
- [ ] Better visualization for code running on the graph
- [ ] More customization options

See the [open issues][issues-url] for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Dylan Wang - dwang2022@gmail.com

LinkedIn: [https://www.linkedin.com/in/dylanwang1/](https://www.linkedin.com/in/dylanwang1/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Graphviz](https://graphviz.org) and [@hpcc-js/wasm-graphviz](https://github.com/hpcc-systems/hpcc-js-wasm) for the layout engine
* [CRXJS](https://crxjs.dev/vite-plugin) for the Manifest V3 build pipeline
* [Inter Tight](https://github.com/googlefonts/inter-tight) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/), bundled through [Fontsource](https://fontsource.org)
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template) for this README's structure
* [Shields.io](https://shields.io) for the badges

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[stars-shield]: https://img.shields.io/github/stars/dwang1257/Graphy.svg?style=for-the-badge
[stars-url]: https://github.com/dwang1257/Graphy/stargazers
[forks-shield]: https://img.shields.io/github/forks/dwang1257/Graphy.svg?style=for-the-badge
[forks-url]: https://github.com/dwang1257/Graphy/network/members
[issues-shield]: https://img.shields.io/github/issues/dwang1257/Graphy.svg?style=for-the-badge
[issues-url]: https://github.com/dwang1257/Graphy/issues
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/dylanwang1/
[typescript-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[preact-shield]: https://img.shields.io/badge/Preact-673AB8?style=for-the-badge&logo=preact&logoColor=white
[preact-url]: https://preactjs.com/
[vite-shield]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[vite-url]: https://vite.dev/
[graphviz-shield]: https://img.shields.io/badge/Graphviz-004C99?style=for-the-badge&logo=graphviz&logoColor=white
[graphviz-url]: https://graphviz.org/
