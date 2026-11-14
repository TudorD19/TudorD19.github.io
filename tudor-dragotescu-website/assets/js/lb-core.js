/*
 * Load balancer model used by the simulation on the page.
 * Pure logic, no DOM: it also runs in Node so it can be tested (see tests/).
 *
 * Behaviour modelled (it follows the project README):
 *   - new connections are assigned round-robin across servers that are online
 *   - a flow, keyed by client IP and source port, keeps its server for every
 *     later packet (connection persistence)
 *   - when a server is taken offline, new connections skip it; a flow that was
 *     mapped to it loses that mapping when its next packet arrives and is then
 *     assigned a new server (the established connection is not migrated)
 *   - when a server comes back it returns to the round-robin pool
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LBCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FIRST_PORT = 49152;

  function createBalancer(serverDefs, options) {
    options = options || {};
    var clientIp = options.clientIp || "10.0.0.1";

    var servers = serverDefs.map(function (def) {
      return { id: def.id, name: def.name, ip: def.ip, up: true, packets: 0 };
    });
    var flows = [];
    var pointer = 0; // index of the server the rotation tries next
    var nextPort = FIRST_PORT;
    var refused = 0;

    function serverById(id) {
      for (var i = 0; i < servers.length; i++) {
        if (servers[i].id === id) return servers[i];
      }
      return null;
    }

    function flowById(id) {
      for (var i = 0; i < flows.length; i++) {
        if (flows[i].id === id) return flows[i];
      }
      return null;
    }

    /* Index of the next online server in the rotation, or -1 if all are offline. */
    function nextIndex() {
      for (var step = 0; step < servers.length; step++) {
        var index = (pointer + step) % servers.length;
        if (servers[index].up) return index;
      }
      return -1;
    }

    function pick() {
      var index = nextIndex();
      if (index === -1) return null;
      pointer = (index + 1) % servers.length;
      return servers[index];
    }

    function peekNext() {
      var index = nextIndex();
      return index === -1 ? null : servers[index];
    }

    /* A new client connection: choose a server and deliver the first packet. */
    function connect() {
      var port = nextPort++;
      var client = clientIp + ":" + port;
      var server = pick();
      if (!server) {
        refused++;
        return { type: "refused", client: client };
      }
      var flow = { id: port, client: client, serverId: server.id, packets: 1 };
      flows.push(flow);
      server.packets++;
      return { type: "connected", flow: flow, server: server };
    }

    /*
     * Another packet on an existing flow. Normally it goes to the server the flow
     * already has. If that server is offline, the stale mapping is removed and the
     * flow is assigned a new server, or dropped when no server is online.
     */
    function send(flowId) {
      var flow = flowById(flowId);
      if (!flow) return { type: "unknown-flow", flowId: flowId };
      var server = serverById(flow.serverId);

      if (!server.up) {
        var target = pick();
        if (!target) {
          flows.splice(flows.indexOf(flow), 1);
          return { type: "dropped", flow: flow, from: server };
        }
        flow.serverId = target.id;
        flow.packets++;
        target.packets++;
        return { type: "remapped", flow: flow, from: server, server: target };
      }

      flow.packets++;
      server.packets++;
      return { type: "packet", flow: flow, server: server };
    }

    function close(flowId) {
      var flow = flowById(flowId);
      if (!flow) return { type: "unknown-flow", flowId: flowId };
      flows.splice(flows.indexOf(flow), 1);
      return { type: "closed", flow: flow };
    }

    function mappedTo(server) {
      return flows.filter(function (flow) {
        return flow.serverId === server.id;
      }).length;
    }

    /*
     * Take a server offline or bring it back. Mappings are not touched here:
     * they are checked when the next packet of each flow arrives (see send).
     */
    function setServerUp(serverId, up) {
      var server = serverById(serverId);
      if (!server) return { type: "unknown-server", serverId: serverId };
      if (server.up === up) return { type: "unchanged", server: server };
      server.up = up;
      return { type: up ? "up" : "down", server: server, mapped: mappedTo(server) };
    }

    function snapshot() {
      var total = 0;
      var view = servers.map(function (server) {
        total += server.packets;
        var count = 0;
        flows.forEach(function (flow) {
          if (flow.serverId === server.id) count++;
        });
        return {
          id: server.id,
          name: server.name,
          ip: server.ip,
          up: server.up,
          packets: server.packets,
          flows: count
        };
      });
      var next = peekNext();
      return {
        servers: view,
        flows: flows.map(function (flow) {
          return {
            id: flow.id,
            client: flow.client,
            serverId: flow.serverId,
            serverName: serverById(flow.serverId).name,
            stale: !serverById(flow.serverId).up,
            packets: flow.packets
          };
        }),
        totalPackets: total,
        refused: refused,
        nextServerId: next ? next.id : null
      };
    }

    return {
      connect: connect,
      send: send,
      close: close,
      setServerUp: setServerUp,
      snapshot: snapshot
    };
  }

  return { createBalancer: createBalancer };
});
