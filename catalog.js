/* Design-shell samples only. These three records were written for layout review.
   They are not entries from the Grokbot posts dataset. */
window.GROK_CATALOG = [
  {
    name: "SAMPLE-note.md",
    path: "samples/SAMPLE-note.md",
    source: "samples/SAMPLE-note.md",
    description: "Sample record written for this design shell. It stands in for a markdown file so the page has a card to draw.",
    descriptionFrom: "markdown",
    type: "markdown",
    place: "sample",
    tags: ["sample", "design-shell"],
    stats: { bytes: 96, ext: "md", lines: 2, chars: 88 },
    text: "Placeholder note for the design shell. Swap this file for a real catalog when you have one."
  },
  {
    name: "SAMPLE-card.jsonl",
    path: "samples/SAMPLE-card.jsonl::L1",
    source: "samples/SAMPLE-card.jsonl",
    description: "Sample list card. The sentence below is layout filler, not a collected post.",
    descriptionFrom: "fields",
    type: "grokbot_posts",
    place: "sample",
    line: 1,
    tags: ["sample", "design-shell"],
    stats: {
      id: "sample-card",
      bytes: 72,
      lines: 1,
      chars: 64,
      dates: [{ key: "written", value: "2026-01-01" }],
      counts: [{ key: "words", value: 14 }]
    },
    record: {
      title: "Sample catalog card",
      text: "This sentence exists so the list card and the detail page have something to show."
    },
    text: "This sentence exists so the list card and the detail page have something to show."
  },
  {
    name: "SAMPLE-layout.py",
    path: "samples/SAMPLE-layout.py",
    source: "samples/SAMPLE-layout.py",
    description: "Sample code file so a second chip and a file-shaped detail view are visible.",
    descriptionFrom: "docstring",
    type: "python",
    place: "sample",
    tags: ["sample", "design-shell"],
    stats: { bytes: 48, ext: "py", lines: 2, chars: 42 },
    text: "# Sample file entry for the design shell.\n"
  }
];
