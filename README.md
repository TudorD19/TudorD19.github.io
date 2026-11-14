# Tudor Dragotescu: personal website

A static personal site: plain HTML, CSS and JavaScript, with no build step and no dependencies. It runs from any static host, including GitHub Pages.

The page has six sections (Projects, Simulation, Education, Skills, Achievements, Contact) and an interactive model of the Layer 4 load balancer project.

## Project structure

```
index.html                 Page structure and most of the text
assets/css/styles.css      All styles
assets/js/site-data.js     Projects and the CV setting  <- edit this most often
assets/js/main.js          Navigation, project list, "Download CV" button
assets/js/lb-core.js       Load balancer model (pure logic, no DOM)
assets/js/lb-ui.js         Simulation interface
assets/img/                Portrait and project screenshots
assets/fonts/              Self-hosted fonts (SIL Open Font License)
assets/favicon.svg
tests/lb-core.test.js      Tests for the load balancer model
.nojekyll                  Tells GitHub Pages to serve the files as they are
```

## Run it locally

The quickest way is to open `index.html` in a browser. Everything works from the file system.

To serve it the way a host would, run a local server from the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

### Run the tests

The simulation logic has tests that need only Node.js 18 or newer:

```bash
node --test
```

## Publish on GitHub Pages

All paths in the site are relative, so it works both at `https://<user>.github.io/` and at `https://<user>.github.io/<repo>/`.

1. Create a repository on GitHub.
   - Name it `TudorD19.github.io` to get the address `https://tudord19.github.io/`.
   - Any other name, for example `website`, gives `https://tudord19.github.io/website/`.
2. Push the files from this folder:

   ```bash
   git init
   git add .
   git commit -m "Add personal website"
   git branch -M main
   git remote add origin https://github.com/TudorD19/<repository-name>.git
   git push -u origin main
   ```

3. On GitHub, open the repository, then **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the `main` branch and the `/ (root)` folder, then save.
5. Wait a minute or two. The same page then shows the public address of the site.

Every later `git push` to `main` updates the site.

## Updating projects

Projects live in `assets/js/site-data.js`, in the `projects` list. They appear on the page in the same order as in the file.

To add a project, copy an existing entry and change the values:

```js
{
  title: "Project name",
  date: "March 2027",
  context: "Solo project, Operating Systems course",
  stack: ["C", "Linux"],
  summary: "One or two sentences about what it is, written in first person.",
  points: [
    "A concrete thing I built or decided.",
    "Another one."
  ],
  links: [
    { label: "Code on GitHub", url: "https://github.com/TudorD19/project-name" }
  ]
}
```

| Field      | Required | What it is                                                        |
|------------|----------|-------------------------------------------------------------------|
| `title`    | yes      | Project name                                                      |
| `date`     | yes      | When it was built                                                 |
| `context`  | yes      | One short line: team or solo, course or event                     |
| `stack`    | yes      | Technologies, shown as small tags                                 |
| `summary`  | yes      | One or two sentences                                              |
| `points`   | no       | List of contributions                                             |
| `links`    | no       | List of `{ label, url }`                                          |
| `demo`     | no       | `{ label, target }`, a link to a section of this page             |
| `image`    | no       | A screenshot, see below                                           |
| `featured` | no       | `true` adds the "Featured project" label. Use it on one only     |

Remember the comma between entries. To remove a project, delete its entry.

Every project is shown in the same block: title, summary, image, a bulleted "What I worked on" list and links. The one marked `featured: true` also gets the "Featured project" label. To feature a different project, move `featured: true` to it.

### Adding a screenshot to a project

Put the image in `assets/img/` and add an `image` entry to the project:

```js
image: {
  src: "assets/img/project-screenshot.webp",
  width: 1800,
  height: 1110,
  alt: "What the screenshot shows, for people who cannot see it.",
  caption: "One line shown under the image."
}
```

`width` and `height` are the size of the file in pixels; they stop the page from jumping while the image loads. Two more fields are optional: `srcSmall`, a copy about 1000 px wide for phones, and `fallback`, a JPEG or PNG copy for browsers without WebP. Keep screenshots under roughly 200 KB.

The Knowledge Graph image is an illustration, not a screenshot. It is the text file `assets/img/knowledge-graph.svg`, so the labels in it can be edited in any editor.

## Changing the photo

The portrait at the top of the page is in `assets/img/`, in two sizes and two formats:

```
tudor-dragotescu-1200.webp   tudor-dragotescu-1200.jpg   (1200 x 1500 px)
tudor-dragotescu-640.webp    tudor-dragotescu-640.jpg    (640 x 800 px)
```

To replace it, export the new photo with a 4:5 shape in those four files and keep the names. With different names, update the `<figure class="hero__portrait">` block in `index.html`.

## Adding the "Download CV" button

The button is hidden until a PDF is configured.

1. Put the PDF in the `assets` folder, for example `assets/Tudor_Dragotescu_CV.pdf`.
2. In `assets/js/site-data.js`, set:

   ```js
   cvPdf: "assets/Tudor_Dragotescu_CV.pdf",
   ```

The button then appears next to "Explore my projects" and in the Contact section. Set `cvPdf` back to `""` to hide it.

## Updating other content

Education, skills, training, awards and contact details are plain HTML in `index.html`. Each section is marked with an `id` (`education`, `skills`, `achievements`, `contact`), so it is easy to find.

If a section is added or renamed, update the links in `<nav id="site-nav">` to match.

## The simulation

`assets/js/lb-core.js` models the behaviour described in the load balancer project's README:

- new connections are assigned round-robin across the servers that are online;
- a connection, identified by client IP and source port, keeps its server;
- when a server is taken offline, new connections skip it, and a connection mapped to it gets a new server when its next packet arrives;
- when a server is brought back online, it returns to the round-robin pool.

It is a simplified model for the page, not the project code. The list of servers is at the top of `assets/js/lb-ui.js`. After changing the model, run `node --test`.

## Accessibility

- Every control is a real link or button and works from the keyboard.
- There is a "Skip to content" link, visible focus outlines, and the mobile menu closes with Escape.
- Server state is shown as text ("Online", "Offline"), not only as colour, and changes are announced to screen readers.
- Animations are switched off when the system asks for reduced motion.

## Fonts

Newsreader, IBM Plex Sans and IBM Plex Mono are served from `assets/fonts`, so the site makes no third-party requests. Their licence is in `assets/fonts/LICENSE.txt`.
