/* The simulation on the page: draws the model from lb-core.js and wires up the controls. */
(function () {
  "use strict";

  var stage = document.getElementById("sim-stage");
  if (!stage || !window.LBCore) return;

  var SERVERS = [
    { id: "s1", name: "Server 1", ip: "10.0.0.2" },
    { id: "s2", name: "Server 2", ip: "10.0.0.3" },
    { id: "s3", name: "Server 3", ip: "10.0.0.4" }
  ];
  var MAX_FLOWS = 6;
  var MAX_LOG = 30;
  var TICK_MS = 750;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var clientNode = document.getElementById("sim-client");
  var lbNode = document.getElementById("sim-lb");
  var serverList = document.getElementById("sim-servers");
  var wires = document.getElementById("sim-wires");
  var packetLayer = document.getElementById("sim-packets");
  var nextLabel = document.getElementById("sim-next");
  var flowsBody = document.getElementById("sim-flows");
  var flowsEmpty = document.getElementById("sim-flows-empty");
  var flowsTable = flowsBody.closest("table");
  var logList = document.getElementById("sim-log");
  var logEmpty = document.getElementById("sim-log-empty");
  var statusLine = document.getElementById("sim-status");
  var autoButton = document.getElementById("sim-auto");
  var connectButton = document.getElementById("sim-connect");
  var sendButton = document.getElementById("sim-send");
  var resetButton = document.getElementById("sim-reset");

  var balancer = window.LBCore.createBalancer(SERVERS);
  var serverViews = {};
  var timer = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function plural(count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
  }

  /* ---- Build the server cards once --------------------------------- */
  SERVERS.forEach(function (server) {
    var item = el("li", "server");
    item.id = "sim-server-" + server.id;

    var head = el("div", "server__head");
    head.appendChild(el("span", "server__name", server.name));
    head.appendChild(el("span", "server__addr", server.ip));
    var state = el("span", "server__state", "Online");
    head.appendChild(state);

    var toggle = el("button", "btn btn--line server__toggle");
    toggle.type = "button";
    var toggleText = el("span", "", "Take offline");
    toggle.appendChild(toggleText);
    toggle.appendChild(el("span", "visually-hidden", ": " + server.name));

    var stats = el("div", "server__stats");
    var packets = el("b", "", "0");
    var flows = el("b", "", "0");
    var share = el("b", "", "0%");
    var packetStat = el("span");
    var packetWord = document.createTextNode(" packets");
    var flowWord = document.createTextNode(" connections");
    packetStat.appendChild(packets);
    packetStat.appendChild(packetWord);
    var flowStat = el("span");
    flowStat.appendChild(flows);
    flowStat.appendChild(flowWord);
    var shareStat = el("span");
    shareStat.appendChild(share);
    shareStat.appendChild(document.createTextNode(" of traffic"));
    stats.appendChild(packetStat);
    stats.appendChild(flowStat);
    stats.appendChild(shareStat);

    var bar = el("div", "server__bar");
    var barFill = el("span");
    bar.appendChild(barFill);

    item.appendChild(head);
    item.appendChild(toggle);
    item.appendChild(stats);
    item.appendChild(bar);
    serverList.appendChild(item);

    toggle.addEventListener("click", function () {
      var current = balancer.snapshot().servers.filter(function (s) {
        return s.id === server.id;
      })[0];
      handle(balancer.setServerUp(server.id, !current.up));
      render();
    });

    serverViews[server.id] = {
      item: item,
      state: state,
      toggleText: toggleText,
      packets: packets,
      packetWord: packetWord,
      flows: flows,
      flowWord: flowWord,
      share: share,
      barFill: barFill
    };
  });

  /* ---- Geometry: wires and moving packets -------------------------- */
  function point(node, side) {
    var box = node.getBoundingClientRect();
    var frame = stage.getBoundingClientRect();
    var x = box.left - frame.left;
    var y = box.top - frame.top;
    if (side === "left") return { x: x, y: y + box.height / 2 };
    if (side === "right") return { x: x + box.width, y: y + box.height / 2 };
    if (side === "top") return { x: x + box.width / 2, y: y };
    if (side === "bottom") return { x: x + box.width / 2, y: y + box.height };
    return { x: x + box.width / 2, y: y + box.height / 2 };
  }

  /* Side by side on wide screens, stacked on narrow ones. */
  function isStacked() {
    return lbNode.getBoundingClientRect().top >= clientNode.getBoundingClientRect().bottom;
  }

  /*
   * Paths the packets follow. Each server gets a list of points from the
   * balancer to the server. Side by side that is one straight line. Stacked,
   * the path runs down a shared trunk on the left and then into the server.
   */
  function routes() {
    var stacked = isStacked();
    var result = {
      stacked: stacked,
      clientOut: point(clientNode, stacked ? "bottom" : "right"),
      lbIn: point(lbNode, stacked ? "top" : "left"),
      lbOut: point(lbNode, stacked ? "bottom" : "right"),
      servers: {}
    };
    var firstTop = point(serverViews[SERVERS[0].id].item, "top");
    var bendY = (result.lbOut.y + firstTop.y) / 2;
    SERVERS.forEach(function (server) {
      var entry = point(serverViews[server.id].item, "left");
      if (!stacked) {
        result.servers[server.id] = [result.lbOut, entry];
        return;
      }
      var trunkX = entry.x - 12;
      result.servers[server.id] = [
        result.lbOut,
        { x: result.lbOut.x, y: bendY },
        { x: trunkX, y: bendY },
        { x: trunkX, y: entry.y },
        entry
      ];
    });
    return result;
  }

  function drawWires() {
    var frame = stage.getBoundingClientRect();
    var route = routes();
    var snapshot = balancer.snapshot();
    wires.setAttribute("viewBox", "0 0 " + frame.width + " " + frame.height);
    while (wires.firstChild) wires.removeChild(wires.firstChild);

    function line(from, to, down) {
      var node = document.createElementNS(SVG_NS, "line");
      node.setAttribute("x1", from.x);
      node.setAttribute("y1", from.y);
      node.setAttribute("x2", to.x);
      node.setAttribute("y2", to.y);
      if (down) node.setAttribute("class", "is-down");
      wires.appendChild(node);
    }

    line(route.clientOut, route.lbIn, false);

    if (route.stacked) {
      // Shared trunk first, then one short branch into each server.
      var last = route.servers[SERVERS[SERVERS.length - 1].id];
      line(last[0], last[1], false);
      line(last[1], last[2], false);
      line(last[2], last[3], false);
    }
    snapshot.servers.forEach(function (server) {
      var path = route.servers[server.id];
      line(path[path.length - 2], path[path.length - 1], !server.up);
    });
  }

  function flash(serverId) {
    var item = serverViews[serverId].item;
    item.classList.add("is-hit");
    window.setTimeout(function () {
      item.classList.remove("is-hit");
    }, 320);
  }

  function animatePacket(serverId) {
    if (reduceMotion.matches || typeof packetLayer.animate !== "function") {
      flash(serverId);
      return;
    }
    var route = routes();
    var path = [route.clientOut, route.lbIn].concat(route.servers[serverId]);
    var dot = el("span", "sim__packet");
    packetLayer.appendChild(dot);

    var lengths = [0];
    for (var i = 1; i < path.length; i++) {
      var dx = path[i].x - path[i - 1].x;
      var dy = path[i].y - path[i - 1].y;
      lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    var total = lengths[lengths.length - 1] || 1;
    var frames = path.map(function (p, index) {
      return {
        transform: "translate(" + p.x + "px, " + p.y + "px)",
        offset: index === path.length - 1 ? 1 : lengths[index] / total
      };
    });

    var duration = Math.min(1100, Math.max(520, total * 1.5));
    var animation = dot.animate(frames, { duration: duration, easing: "linear" });
    animation.onfinish = animation.oncancel = function () {
      dot.remove();
      flash(serverId);
    };
  }

  /* ---- Log --------------------------------------------------------- */
  function log(message, kind) {
    var item = el("li", kind ? "is-" + kind : "", message);
    logList.insertBefore(item, logList.firstChild);
    while (logList.children.length > MAX_LOG) logList.removeChild(logList.lastChild);
    logEmpty.hidden = true;
  }

  function announce(message) {
    statusLine.textContent = message;
  }

  /* Turn a result from the model into log lines and packet animations. */
  function handle(result) {
    var message;
    if (result.type === "connected") {
      log("New connection from " + result.flow.client + " goes to " + result.server.name + " (round-robin).");
      animatePacket(result.server.id);
    } else if (result.type === "packet") {
      animatePacket(result.server.id);
    } else if (result.type === "remapped") {
      message =
        result.flow.client + " was mapped to " + result.from.name + ", which is offline. " +
        "Mapping removed, and the connection is set up again on " + result.server.name + ".";
      log(message);
      animatePacket(result.server.id);
    } else if (result.type === "dropped") {
      message =
        result.flow.client + " was mapped to " + result.from.name +
        ", which is offline, and no other server is online. Connection dropped.";
      log(message, "down");
      announce(message);
    } else if (result.type === "refused") {
      message = "Connection from " + result.client + " refused: no server is online.";
      log(message, "down");
      announce(message);
    } else if (result.type === "down") {
      message = result.server.name + " taken offline. New connections skip it.";
      if (result.mapped) {
        message +=
          " " + plural(result.mapped, "connection") + " still " + (result.mapped === 1 ? "maps" : "map") +
          " to it and will get a new server on " + (result.mapped === 1 ? "its" : "their") + " next packet.";
      }
      log(message, "down");
      announce(message);
    } else if (result.type === "up") {
      message = result.server.name + " is back online and returns to the round-robin pool.";
      if (result.mapped) {
        message +=
          " " + plural(result.mapped, "connection") + " that still mapped to it " +
          (result.mapped === 1 ? "carries" : "carry") + " on there.";
      }
      log(message, "up");
      announce(message);
    }
  }

  /* ---- Render ------------------------------------------------------ */
  function render() {
    var snapshot = balancer.snapshot();

    snapshot.servers.forEach(function (server) {
      var view = serverViews[server.id];
      var share = snapshot.totalPackets ? Math.round((server.packets / snapshot.totalPackets) * 100) : 0;
      view.item.classList.toggle("is-down", !server.up);
      view.state.textContent = server.up ? "Online" : "Offline";
      view.toggleText.textContent = server.up ? "Take offline" : "Bring back online";
      view.packets.textContent = server.packets;
      view.packetWord.nodeValue = server.packets === 1 ? " packet" : " packets";
      view.flows.textContent = server.flows;
      view.flowWord.nodeValue = server.flows === 1 ? " connection" : " connections";
      view.share.textContent = share + "%";
      view.barFill.style.width = share + "%";
    });

    var next = snapshot.servers.filter(function (server) {
      return server.id === snapshot.nextServerId;
    })[0];
    nextLabel.textContent = next ? next.name : "none, all servers offline";

    while (flowsBody.firstChild) flowsBody.removeChild(flowsBody.firstChild);
    snapshot.flows.forEach(function (flow) {
      var row = el("tr");
      row.appendChild(el("td", "", flow.client));
      row.appendChild(el("td", flow.stale ? "is-stale" : "", flow.serverName + (flow.stale ? " (offline, mapping is stale)" : "")));
      row.appendChild(el("td", "num", String(flow.packets)));
      flowsBody.appendChild(row);
    });
    flowsTable.hidden = snapshot.flows.length === 0;
    flowsEmpty.hidden = snapshot.flows.length !== 0;

    drawWires();
  }

  /* ---- Actions ----------------------------------------------------- */
  function openConnection() {
    var snapshot = balancer.snapshot();
    if (snapshot.flows.length >= MAX_FLOWS) {
      var oldest = snapshot.flows[0];
      balancer.close(oldest.id);
      log("Connection from " + oldest.client + " closed.");
    }
    handle(balancer.connect());
  }

  function sendOnEveryFlow() {
    var flows = balancer.snapshot().flows;
    if (!flows.length) {
      openConnection();
      return;
    }
    flows.forEach(function (flow, index) {
      window.setTimeout(function () {
        handle(balancer.send(flow.id));
        render();
      }, index * 90);
    });
  }

  function tick() {
    var flows = balancer.snapshot().flows;
    var roll = Math.random();
    if (flows.length < 3 || roll < 0.22) {
      openConnection();
    } else {
      var flow = flows[Math.floor(Math.random() * flows.length)];
      handle(balancer.send(flow.id));
    }
    render();
  }

  function setAuto(on) {
    if (on && !timer) {
      timer = window.setInterval(tick, TICK_MS);
      tick();
    } else if (!on && timer) {
      window.clearInterval(timer);
      timer = null;
    }
    autoButton.textContent = timer ? "Pause traffic" : "Start traffic";
  }

  autoButton.addEventListener("click", function () {
    setAuto(!timer);
  });

  connectButton.addEventListener("click", function () {
    openConnection();
    render();
  });

  sendButton.addEventListener("click", function () {
    sendOnEveryFlow();
    render();
  });

  resetButton.addEventListener("click", function () {
    setAuto(false);
    balancer = window.LBCore.createBalancer(SERVERS);
    while (logList.firstChild) logList.removeChild(logList.firstChild);
    while (packetLayer.firstChild) packetLayer.removeChild(packetLayer.firstChild);
    logEmpty.hidden = false;
    announce("Simulation reset. All servers are online.");
    render();
  });

  /* Pause the traffic while the tab is in the background. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setAuto(false);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(drawWires).observe(stage);
  } else {
    window.addEventListener("resize", drawWires);
  }

  render();
})();
