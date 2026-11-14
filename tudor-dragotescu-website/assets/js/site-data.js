/*
 * Site content that changes over time lives here.
 * Edit this file to update projects or to switch on the "Download CV" button.
 * See README.md, section "Updating projects".
 */
window.SITE = {
  /*
   * Path to a PDF copy of the CV, relative to index.html.
   * Leave empty to hide the "Download CV" button.
   * Example: "assets/Tudor_Dragotescu_CV.pdf"
   */
  cvPdf: "",

  /*
   * Projects are shown in the order they appear in this list.
   * Fields:
   *   title    (required) project name
   *   date     (required) when it was built, e.g. "July 2026"
   *   context  (required) one short line: team or solo, course or event
   *   stack    (required) list of technologies
   *   summary  (required) one or two sentences in first person
   *   points   (optional) list of concrete contributions
   *   links    (optional) list of { label, url }
   *   demo     (optional) { label, target } linking to a section on this page
   *   image    (optional) { src, width, height, alt, caption } a screenshot;
   *            srcSmall is a smaller copy for phones, fallback a JPEG copy
   *   featured (optional) true adds the "Featured project" label; use it on one project
   */
  projects: [
    {
      title: "Layer 4 Load Balancer and Live Monitoring Dashboard",
      date: "July 2026",
      context: "Team project, Network Security & Design Summer School hackathon (NSDSS)",
      stack: ["Python", "Scapy", "Mininet", "Flask"],
      summary:
        "With my team I built a Layer 4 load balancer that runs inside a Mininet network. " +
        "Clients talk to one virtual IP, and the balancer rewrites each packet with Scapy to spread the traffic across three backend servers.",
      points: [
        "I co-developed the balancer itself: the virtual IP and the Scapy-based packet rewriting that sends client traffic to the backends.",
        "I implemented round-robin backend selection, connection persistence and automatic failover, and checked with packet captures that traffic was redistributed after a backend failed.",
        "I built a Flask API and a live dashboard that show connections, flows and how packets are split between servers.",
        "I worked with the team on integration and refactoring during a four-hour sprint before the final demo."
      ],
      links: [
        { label: "Code on GitHub", url: "https://github.com/mihneateo22/Load_Balancer" }
      ],
      demo: { label: "Try the simulation", target: "#simulation" },
      image: {
        src: "assets/img/load-balancer-dashboard-1800.webp",
        srcSmall: "assets/img/load-balancer-dashboard-1000.webp",
        fallback: "assets/img/load-balancer-dashboard-1800.jpg",
        width: 1800,
        height: 1110,
        alt:
          "The load balancer dashboard. A diagram shows one client, the load balancer at 10.0.0.100 and three servers. " +
          "A bar shows traffic split 33.3%, 32.8% and 33.8% between the servers, and three panels list packets, connections, flows and latency for each server.",
        caption: "The live dashboard during a test run, with traffic split almost evenly across the three servers."
      },
      featured: true
    },
    {
      title: "Knowledge Graph",
      date: "May 2026",
      context: "Academic project, data structures",
      stack: ["C"],
      summary:
        "A knowledge graph written in C that stores entities and the relationships between them, and answers queries about how they connect.",
      points: [
        "I implemented the graph, binary search tree, queue and heap data structures that the project is built on.",
        "I wrote BFS-based graph traversal and the query parsing.",
        "I managed memory by hand across a modular, multi-file C codebase."
      ],
      image: {
        src: "assets/img/knowledge-graph.svg",
        width: 1800,
        height: 1110,
        alt:
          "Illustration of a directed, weighted graph with seven example entities joined by numbered arrows. " +
          "Two routes from Bucharest to London are highlighted: the one with the fewest edges, through Paris, " +
          "and the one with the lowest total cost, through Vienna and Berlin. A side panel lists the five query types: " +
          "EXISTS, EDGE, NEIGHBORS, PATH and DIJKSTRA.",
        caption:
          "An illustration with example data: the same pair of entities, joined by the path with the fewest edges and by the path with the lowest cost."
      },
      links: [
        { label: "Code on GitHub", url: "https://github.com/TudorD19/Knowledge-Graph" }
      ]
    }
  ]
};
