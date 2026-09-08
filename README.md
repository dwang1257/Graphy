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
    <li><a href="#usage">Usage</a></li>
    <li><a href="#customization">Customization</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Graphy is a highly customizable graph visualizer for LeetCode problems. You can change the background, nodes, and edges as you please.

Graphy reads the test case straight out of the editor and renders it in a floating panel next to the problem. Currently it supports binary trees, linked lists, and graphs.

It can also show how your code runs on that drawing. Hit **Run** and Graphy highlights the walk: the current node, the nodes you have already visited, and the frontier (queue or stack) as the algorithm moves. On Python tree problems this happens automatically — Graphy traces the solution without you changing the editor, and **pointer swaps and deletions reshape the tree** (nodes slide to their new positions). In any language you can print `#graphy` lines (`current`, `visit`, `enqueue`, `dequeue`, `frontier`, `topology`) and step through them with the play / pause / scrubber under the graph.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Supported Structures

| Structure | Example input |
| --- | --- |
| Binary tree | `[3,9,20,null,null,15,7]` |
| Linked list | `[1,2,3,4]`, `pos = 1` |
| Graph | `["11110","10001"]`, `[[1,1,0],[1,1,0],[0,0,1]]` |

Pick the structure from the dropdown in the panel's title bar.

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
