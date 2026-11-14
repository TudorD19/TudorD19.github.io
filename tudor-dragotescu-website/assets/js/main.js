/* Navigation, project list and the optional "Download CV" button. */
(function () {
  "use strict";

  var site = window.SITE || { projects: [], cvPdf: "" };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function isExternal(url) {
    return /^https?:\/\//.test(url);
  }

  function link(label, url, className) {
    var a = el("a", className || "text-link", label);
    a.href = url;
    if (isExternal(url)) a.rel = "noopener";
    return a;
  }

  /* ---- Mobile navigation ------------------------------------------ */
  function setUpNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---- Mark the section currently in view -------------------------- */
  function setUpCurrentSection() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
    var header = document.querySelector(".site-header__inner");
    if (!links.length) return;

    var sections = links
      .map(function (a) {
        return document.getElementById(a.getAttribute("href").slice(1));
      })
      .filter(Boolean);
    var scheduled = false;

    function update() {
      scheduled = false;
      var root = document.documentElement;
      /* A section becomes current once its top passes a line a little below the header. */
      var marker = (header ? header.offsetHeight : 0) + window.innerHeight * 0.3;
      var current = null;
      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= marker) current = section.id;
      });
      /* At the very end of the page the last section is current, however short it is. */
      if (window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
        current = sections[sections.length - 1].id;
      }
      links.forEach(function (a) {
        if (a.getAttribute("href") === "#" + current) {
          a.setAttribute("aria-current", "true");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
  }

  /* ---- Projects ---------------------------------------------------- */
  function stackList(project) {
    var stack = el("ul", "tags");
    stack.setAttribute("aria-label", "Built with");
    (project.stack || []).forEach(function (item) {
      stack.appendChild(el("li", "", item));
    });
    return stack;
  }

  function linkRow(project) {
    var links = el("p", "project__links");
    if (project.demo) links.appendChild(link(project.demo.label, project.demo.target));
    (project.links || []).forEach(function (item) {
      links.appendChild(link(item.label, item.url));
    });
    return links.childNodes.length ? links : null;
  }

  function figure(image, className) {
    var fig = el("figure", className);
    var picture = el("picture");
    if (/\.webp$/.test(image.src)) {
      var source = el("source");
      source.type = "image/webp";
      source.srcset = image.srcSmall ? image.srcSmall + " 1000w, " + image.src + " " + (image.width || 1800) + "w" : image.src;
      if (image.srcSmall) source.sizes = "(max-width: 40rem) 92vw, 62rem";
      picture.appendChild(source);
    }
    var img = el("img");
    img.src = image.fallback || image.src;
    img.alt = image.alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    if (image.width) img.width = image.width;
    if (image.height) img.height = image.height;
    picture.appendChild(img);
    fig.appendChild(picture);
    if (image.caption) fig.appendChild(el("figcaption", "", image.caption));
    return fig;
  }

  /* Every project uses the same block. "featured" only adds the label on top. */
  function renderProject(project) {
    var article = el("article", "showcase");

    var head = el("div", "showcase__head");
    var intro = el("div", "showcase__intro");
    if (project.featured) intro.appendChild(el("p", "showcase__flag", "Featured project"));
    intro.appendChild(el("h3", "showcase__title", project.title));
    intro.appendChild(el("p", "showcase__summary", project.summary));
    var meta = el("div", "showcase__meta");
    meta.appendChild(el("p", "project__date", project.date));
    meta.appendChild(el("p", "project__context", project.context));
    if (project.stack && project.stack.length) meta.appendChild(stackList(project));
    head.appendChild(intro);
    head.appendChild(meta);
    article.appendChild(head);

    if (project.image) article.appendChild(figure(project.image, "showcase__figure"));

    if (project.points && project.points.length) {
      article.appendChild(el("h4", "showcase__subtitle", "What I worked on"));
      var points = el("ul", "showcase__points");
      project.points.forEach(function (point) {
        points.appendChild(el("li", "", point));
      });
      article.appendChild(points);
    }

    var links = linkRow(project);
    if (links) article.appendChild(links);
    return article;
  }

  function renderProjects() {
    var list = document.getElementById("project-list");
    if (!list) return;
    (site.projects || []).forEach(function (project) {
      list.appendChild(renderProject(project));
    });
  }

  /* ---- Download CV (only when a PDF path is configured) ------------ */
  function addCvButtons() {
    if (!site.cvPdf) return;

    function cvLink(className) {
      var a = el("a", className, "Download CV");
      a.href = site.cvPdf;
      a.setAttribute("download", "");
      a.type = "application/pdf";
      return a;
    }

    var hero = document.getElementById("hero-actions");
    if (hero) hero.appendChild(cvLink("btn btn--line"));

    var contact = document.getElementById("contact-list");
    if (contact) {
      var holder = el("p", "contact__actions");
      holder.appendChild(cvLink("btn btn--line"));
      contact.parentNode.insertBefore(holder, contact.nextSibling);
    }
  }

  renderProjects();
  addCvButtons();
  setUpNav();
  setUpCurrentSection();
})();
