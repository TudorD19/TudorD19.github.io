/* Run from the project folder with: node --test */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createBalancer } = require("../assets/js/lb-core.js");

const SERVERS = [
  { id: "s1", name: "Server 1", ip: "10.0.0.2" },
  { id: "s2", name: "Server 2", ip: "10.0.0.3" },
  { id: "s3", name: "Server 3", ip: "10.0.0.4" }
];

function connectMany(lb, count) {
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(lb.connect().server.id);
  return ids;
}

function server(lb, id) {
  return lb.snapshot().servers.find((s) => s.id === id);
}

function sendOnAll(lb) {
  return lb.snapshot().flows.map((flow) => lb.send(flow.id));
}

test("new connections are assigned round-robin", () => {
  const lb = createBalancer(SERVERS);
  assert.deepEqual(connectMany(lb, 6), ["s1", "s2", "s3", "s1", "s2", "s3"]);
});

test("a flow keeps its server for later packets", () => {
  const lb = createBalancer(SERVERS);
  const first = lb.connect();
  lb.connect();
  lb.connect();
  for (let i = 0; i < 5; i++) {
    assert.equal(lb.send(first.flow.id).server.id, first.server.id);
  }
  assert.equal(server(lb, "s1").packets, 6);
});

test("flows are keyed by client IP and source port", () => {
  const lb = createBalancer(SERVERS, { clientIp: "10.0.0.9" });
  const a = lb.connect();
  const b = lb.connect();
  assert.equal(a.flow.client, "10.0.0.9:49152");
  assert.equal(b.flow.client, "10.0.0.9:49153");
  assert.notEqual(a.server.id, b.server.id);
});

test("an offline server gets no new connections", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 3);
  assert.equal(lb.setServerUp("s2", false).type, "down");
  assert.ok(!connectMany(lb, 6).includes("s2"));
});

test("taking a server offline leaves its mappings in place, marked stale", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 6);
  const result = lb.setServerUp("s2", false);
  assert.equal(result.mapped, 2);
  const stale = lb.snapshot().flows.filter((flow) => flow.stale);
  assert.equal(stale.length, 2);
  assert.ok(stale.every((flow) => flow.serverId === "s2"));
});

test("a stale mapping is replaced when the flow's next packet arrives", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 6);
  lb.setServerUp("s2", false);
  const before = server(lb, "s2").packets;

  const results = sendOnAll(lb);
  const remapped = results.filter((r) => r.type === "remapped");
  assert.equal(remapped.length, 2);
  assert.ok(remapped.every((r) => r.from.id === "s2" && r.server.id !== "s2"));

  const snap = lb.snapshot();
  assert.equal(snap.flows.length, 6);
  assert.ok(snap.flows.every((flow) => flow.serverId !== "s2" && !flow.stale));
  assert.equal(server(lb, "s2").packets, before); // nothing reached the offline server

  // After the new mapping, the flow stays on its new server.
  const id = remapped[0].flow.id;
  assert.equal(lb.send(id).server.id, remapped[0].server.id);
});

test("a server brought back online returns to the round-robin pool", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 3);
  lb.setServerUp("s2", false);
  sendOnAll(lb);
  connectMany(lb, 4);
  const mappingsBefore = lb.snapshot().flows.map((flow) => flow.serverId);
  const packetsBefore = server(lb, "s2").packets;

  assert.equal(lb.setServerUp("s2", true).type, "up");

  // Existing flows keep the server they already have.
  assert.deepEqual(lb.snapshot().flows.map((flow) => flow.serverId), mappingsBefore);

  // The next full round reaches every server once, the restored one included.
  assert.deepEqual(connectMany(lb, 3).sort(), ["s1", "s2", "s3"]);

  // And the restored server receives packets again.
  sendOnAll(lb);
  const s2 = server(lb, "s2");
  assert.equal(s2.up, true);
  assert.equal(s2.flows, 1);
  assert.equal(s2.packets, packetsBefore + 2);
});

test("a mapping that was never used while its server was offline is valid again", () => {
  const lb = createBalancer(SERVERS);
  const flows = [lb.connect(), lb.connect(), lb.connect()];
  lb.setServerUp("s2", false);
  const back = lb.setServerUp("s2", true);
  assert.equal(back.mapped, 1);
  const result = lb.send(flows[1].flow.id);
  assert.equal(result.type, "packet");
  assert.equal(result.server.id, "s2");
});

test("with every server offline, connections are refused and packets are dropped", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 3);
  SERVERS.forEach((s) => lb.setServerUp(s.id, false));
  assert.equal(lb.connect().type, "refused");
  assert.equal(lb.snapshot().refused, 1);
  assert.equal(lb.snapshot().nextServerId, null);
  const results = sendOnAll(lb);
  assert.ok(results.every((r) => r.type === "dropped"));
  assert.equal(lb.snapshot().flows.length, 0);
});

test("service resumes when one server returns after a full outage", () => {
  const lb = createBalancer(SERVERS);
  SERVERS.forEach((s) => lb.setServerUp(s.id, false));
  lb.setServerUp("s3", true);
  assert.deepEqual(connectMany(lb, 3), ["s3", "s3", "s3"]);
});

test("setting a server to the state it already has changes nothing", () => {
  const lb = createBalancer(SERVERS);
  assert.equal(lb.setServerUp("s1", true).type, "unchanged");
  lb.setServerUp("s1", false);
  assert.equal(lb.setServerUp("s1", false).type, "unchanged");
});

test("per-server packet counts add up to the total", () => {
  const lb = createBalancer(SERVERS);
  connectMany(lb, 5);
  lb.setServerUp("s1", false);
  sendOnAll(lb);
  lb.setServerUp("s1", true);
  connectMany(lb, 2);
  const snap = lb.snapshot();
  const sum = snap.servers.reduce((n, s) => n + s.packets, 0);
  assert.equal(sum, snap.totalPackets);
  assert.equal(snap.totalPackets, 5 + 5 + 2);
});
