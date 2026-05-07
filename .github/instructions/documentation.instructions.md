---
applyTo: "Documentation/**/*.md"
---

# How to Write Documentation

Documentation exists for one audience: **developers who need to use the framework** — not the team that built it. Write from the reader's perspective. They want to know *what this does*, *why they should care*, and *how to use it* — in that order.

## General

- All documentation lives in the `Documentation/` folder.
- Use [Markdown](https://www.markdownguide.org/) with [GitHub Flavored Markdown](https://github.github.com/gfm/).
- Use [Mermaid](https://mermaid-js.github.io/mermaid/#/) for diagrams — architecture flows, state transitions, and sequence diagrams are far clearer as visuals than as prose.

## Structure

- Every folder must have its own `toc.yml` for navigation.
- Every folder must have an `index.md` as a landing page with links to subtopics.
- Use relative links for internal references.

## Writing Style

- **Active voice, present tense.** "Chronicle appends the event" not "The event is appended by Chronicle."
- **Emphasize *why* before *how*.** The reason behind a design choice is more valuable than the steps to implement it.
- **Don't document the obvious.** If the API is self-explanatory, a code example is enough.
- Use headings, lists, and code blocks to organize content.
- Use consistent terminology throughout.

## Code Examples

- Every code example must be complete and correct — no pseudo-code, no `// ...` elisions that leave the reader guessing.
- Never include verbatim code from the repository — APIs may change. Write purpose-built examples.
