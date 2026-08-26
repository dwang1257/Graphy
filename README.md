<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Stargazers][stars-shield]][stars-url]
[![Forks][forks-shield]][forks-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="public/icons/icon128.png" alt="Graphy logo" width="80" height="80">

  <h3 align="center">Graphy</h3>

  <p align="center">
    A customizable graph visualizer for LeetCode test cases.
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
    <li><a href="#usage">Usage</a></li>
    <li><a href="#customization">Customization</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Graphy is a Chrome extension that draws your LeetCode custom test cases as real pictures.

Reading `[3,9,20,null,null,15,7]` and rebuilding the tree in your head is wasted effort.
Graphy reads the test case straight out of the editor, works out what kind of structure each argument is, and renders it in a floating panel next to the problem.
Edit the input and the drawing follows along as you type.

Everything runs locally inside the extension.
There is no account, no server, and no network request - the layout engine is a WebAssembly build of Graphviz bundled with the extension.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Supported Structures

Graphy infers the structure from the function signature first, then the parameter name, then the shape of the literal itself.

| Structure | Recognized from | Example input |
| --- | --- | --- |
| Binary tree | `TreeNode`, `root`, `subRoot`, arrays containing `null` | `[3,9,20,null,null,15,7]` |
| Linked list | `ListNode`, `head`, `headA`, `l1`, plus an optional `pos` for cycles | `[1,2,3,4]`, `pos = 1` |
| Directed graph | `prerequisites`, `trust`, `flights`, `edges1` | `[[1,0],[2,1]]` |
| Undirected graph | `edges`, `connections`, `roads`, `pairs` | `[[0,1],[1,2],[2,0]]` |
| Adjacency list | `adjList`, `graph`, `rooms`, `isConnected` | `[[2,4],[1,3],[2,4],[1,3]]` |
| Grid / matrix | `grid`, `board`, `matrix`, `maze`, equal-length strings | `["11110","10001"]` |

When the guess is wrong, pick the right structure from the dropdown in the panel's title bar.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][typescript-shield]][typescript-url]
* [![Preact][preact-shield]][preact-url]
* [![Vite][vite-shield]][vite-url]
* [![Graphviz][graphviz-shield]][graphviz-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

Graphy is not on the Chrome Web Store yet, so it is installed as an unpacked extension.

### Prerequisites

* Chrome 110 or newer, or any Chromium browser with Manifest V3 support
* [Node.js](https://nodejs.org/) 20 or newer, only if you want to build from source

### Installation

1. Clone the repo.
   ```sh
   git clone https://github.com/dwang1257/Graphy.git
   cd Graphy
   ```
2. Install the dependencies and build the extension.
   ```sh
   npm install
   npm run build
   ```
3. Open `chrome://extensions` and turn on **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `dist` folder inside the repo.
5. Open any LeetCode problem. The panel appears once a custom test case is on screen.

To work on Graphy itself, run `npm run dev` instead of `npm run build`.
Vite rebuilds on save and Chrome reloads the extension for you.
Type errors are checked separately with `npm run typecheck`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

1. Open a problem on [leetcode.com](https://leetcode.com) or [leetcode.cn](https://leetcode.cn).
2. Graphy reads the custom test case and draws it in a floating panel.
3. Edit the test case. The drawing updates while you type.
4. Drag the title bar to move the panel, drag its corner to resize, and use **Fit to view** to recenter the graph.
5. Click the extension icon in the toolbar to toggle the panel on any page.

If the detected structure is wrong, override it with the dropdown in the title bar.
Notes such as a detected cycle position are shown underneath the graph.
Graphs above the node limit are not laid out until you confirm, so a runaway test case cannot lock up the tab.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Customization

Open the settings drawer with the gear icon in the panel. Settings are stored per browser profile and applied immediately.

* **Theme** - follow LeetCode's light or dark mode, or pin one of them
* **Colors** - every fill, stroke, label, and accent color for both themes
* **Nodes** - shape, font family, font size, line weight
* **Edges** - solid, dashed, dotted, or bold, with spline, straight, polyline, orthogonal, or curved routing, and arrowheads on or off
* **Layout** - direction (top-down, left-right, bottom-up, right-left), node spacing, level spacing
* **Details** - null children, linked-list terminator, grid row and column indices
* **Behavior** - open automatically on problem pages, update while typing, and the node count that triggers a warning

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Binary trees, linked lists, graphs, adjacency lists, and grids
- [x] Live rendering while typing
- [x] Full color, layout, and shape customization
- [ ] Weighted edge labels for three-column edge lists
- [ ] Export the current graph as SVG or PNG
- [ ] N-ary trees and tries
- [ ] Chrome Web Store release

See the [open issues][issues-url] for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See [`LICENSE.txt`](LICENSE.txt) for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Dylan Wang - dwang2022@gmail.com

Project Link: [https://github.com/dwang1257/Graphy](https://github.com/dwang1257/Graphy)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Graphviz](https://graphviz.org) and [@hpcc-js/wasm-graphviz](https://github.com/hpcc-systems/hpcc-js-wasm) for the layout engine
* [CRXJS](https://crxjs.dev/vite-plugin) for the Manifest V3 build pipeline
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
[license-shield]: https://img.shields.io/github/license/dwang1257/Graphy.svg?style=for-the-badge
[license-url]: https://github.com/dwang1257/Graphy/blob/main/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/dylanwang1
[typescript-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[preact-shield]: https://img.shields.io/badge/Preact-673AB8?style=for-the-badge&logo=preact&logoColor=white
[preact-url]: https://preactjs.com/
[vite-shield]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[vite-url]: https://vite.dev/
[graphviz-shield]: https://img.shields.io/badge/Graphviz-004C99?style=for-the-badge&logo=graphviz&logoColor=white
[graphviz-url]: https://graphviz.org/
